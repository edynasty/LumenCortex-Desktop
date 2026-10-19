package backend

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/edynasty/LumenCortex/config"
)

// The secrets every leak test plants. A test failure that names one of them found a leak; a
// passing run proves no returned struct JSON, error, log line, event, config file or on-disk
// artifact carries the value.
const (
	secretA = "sk-secret-NEVER-PRINT-9876543210"
	secretB = "sk-secret-NEVER-PRINT-2468"
	secretC = "sk-secret-NEVER-PRINT-1357"
)

// fakeStore is the in-memory credentialStore of the rollback test, whose store must keep
// writing while the configuration directory is unwritable.
type fakeStore struct {
	mu    sync.Mutex
	items map[string]string
}

func newFakeStore() *fakeStore {
	return &fakeStore{items: map[string]string{}}
}

func (f *fakeStore) Set(name, secret string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.items[name] = secret
	return nil
}

func (f *fakeStore) Get(name string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.items[name]
	if !ok {
		return "", fmt.Errorf("%w: %s", config.ErrCredentialNotFound, name)
	}
	return v, nil
}

func (f *fakeStore) Delete(name string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.items, name)
	return nil
}

func (f *fakeStore) len() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.items)
}

// openRuntimeWithStore opens a Runtime whose credential store is the test's own.
func openRuntimeWithStore(t *testing.T, workspace string, store credentialStore) *Runtime {
	t.Helper()
	r := New()
	r.credentials = store
	t.Cleanup(func() { _ = r.Close() })
	if _, err := r.OpenWorkspace(context.Background(), workspace); err != nil {
		t.Fatal(err)
	}
	return r
}

func writeCredentialCatalog(t *testing.T, path, anthropicBase, openaiBase string) {
	t.Helper()
	writeFile(t, path, fmt.Sprintf(`{
  "model": "an/m",
  "providers": {
    "an": {"package": "anthropic-messages", "settings": {"baseURL": %q}, "models": {"m": {"limit": {"context": 65536, "output": 8192}}}},
    "acme": {"settings": {"baseURL": %q}, "models": {"m": {"limit": {"context": 65536, "output": 8192}}}}
  }
}`, anthropicBase, openaiBase))
}

// The full credential lifecycle over the fake store: save -> stored/set -> replace -> new value
// resolves -> remove -> none, plus the picker's availability and the env-reference states.
func TestProviderCredentialLifecycle(t *testing.T) {
	configPath := useConfigDir(t)
	writeCredentialCatalog(t, configPath, "http://127.0.0.1:1", "http://127.0.0.1:2/v1")
	r := openRuntime(t, canonicalDir(t))
	storePath, err := config.DefaultCredentialStorePath()
	if err != nil {
		t.Fatal(err)
	}
	store := config.NewFileCredentialStore(storePath)
	name := credentialName("global", "acme")

	// Before any key: no reference, nothing set.
	status, err := r.GetProviderCredentialStatus("global", "acme")
	if err != nil {
		t.Fatal(err)
	}
	if status != (CredentialStatus{ProviderID: "acme", Scope: "global", Source: "none"}) {
		t.Fatalf("initial status=%#v", status)
	}
	if state, _ := r.ConfigState(); modelSet(t, state, "acme/m") {
		t.Fatal("acme/m must be unset before a key is stored")
	}

	// Save: the store holds the value, the file holds only the reference, the picker sees set.
	status, err = r.SaveProviderCredential("global", "acme", secretA)
	if err != nil {
		t.Fatal(err)
	}
	want := CredentialStatus{
		ProviderID: "acme", Scope: "global", Source: "stored",
		Ref: "{secret:" + name + "}", Set: true,
	}
	if status != want {
		t.Fatalf("status after save=%#v, want %#v", status, want)
	}
	if got, _ := store.Get(name); got != secretA {
		t.Fatalf("store value=%q", got)
	}
	onDisk := readFile(t, configPath)
	if !strings.Contains(onDisk, "{secret:"+name+"}") || strings.Contains(onDisk, secretA) {
		t.Fatalf("the file must carry the reference and never the value: %s", onDisk)
	}
	if state, _ := r.ConfigState(); !modelSet(t, state, "acme/m") {
		t.Fatal("acme/m must be set while the store holds the secret")
	}

	// Replace: the resolver returns the new value.
	if _, err := r.SaveProviderCredential("global", "acme", secretB); err != nil {
		t.Fatal(err)
	}
	if got, _ := store.Get(name); got != secretB {
		t.Fatalf("store value after replace=%q", got)
	}
	if onDisk := readFile(t, configPath); strings.Contains(onDisk, secretB) {
		t.Fatalf("the replaced value leaked into the file: %s", onDisk)
	}

	// Remove: the item is gone, the reference is cleared, the picker sees unset.
	status, err = r.RemoveProviderCredential("global", "acme")
	if err != nil {
		t.Fatal(err)
	}
	if status.Source != "none" || status.Set || status.Ref != "" {
		t.Fatalf("status after remove=%#v", status)
	}
	if _, err := store.Get(name); !errors.Is(err, config.ErrCredentialNotFound) {
		t.Fatalf("store after remove: %v", err)
	}
	if onDisk := readFile(t, configPath); strings.Contains(onDisk, "{secret:") {
		t.Fatalf("the reference must be cleared: %s", onDisk)
	}
	if state, _ := r.ConfigState(); modelSet(t, state, "acme/m") {
		t.Fatal("acme/m must be unset after removal")
	}

	// An {env:NAME} reference is reported from the environment and left alone by removal.
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	acme := doc.Catalog.Providers["acme"]
	acme.Settings.APIKey = "{env:LCX_CRED_SET}"
	doc.Catalog.Providers["acme"] = acme
	if _, err := r.SaveProviderCatalogScope("global", doc); err != nil {
		t.Fatal(err)
	}
	t.Setenv("LCX_CRED_SET", "set")
	status, err = r.GetProviderCredentialStatus("global", "acme")
	if err != nil {
		t.Fatal(err)
	}
	if status.Source != "env" || !status.Set || status.Ref != "{env:LCX_CRED_SET}" {
		t.Fatalf("env status=%#v", status)
	}
	if _, err := r.RemoveProviderCredential("global", "acme"); err != nil {
		t.Fatal(err)
	}
	if after, _ := r.GetProviderCredentialStatus("global", "acme"); after != status {
		t.Fatalf("removal must leave an env reference alone: %#v", after)
	}
	if onDisk := readFile(t, configPath); !strings.Contains(onDisk, "{env:LCX_CRED_SET}") {
		t.Fatalf("the env reference was cleared: %s", onDisk)
	}

	// An unset env reference reports not set.
	doc, err = r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	acme = doc.Catalog.Providers["acme"]
	acme.Settings.APIKey = "{env:LCX_CRED_MISSING}"
	doc.Catalog.Providers["acme"] = acme
	if _, err := r.SaveProviderCatalogScope("global", doc); err != nil {
		t.Fatal(err)
	}
	status, _ = r.GetProviderCredentialStatus("global", "acme")
	if status.Source != "env" || status.Set {
		t.Fatalf("unset env status=%#v", status)
	}
}

func modelSet(t *testing.T, state ConfigState, ref string) bool {
	t.Helper()
	for _, m := range state.Models {
		if string(m.Ref) == ref {
			return m.APIKeySet
		}
	}
	t.Fatalf("model %s is not in the catalog", ref)
	return false
}

// Invalid input is rejected without touching the store: an unknown provider, an empty key, an
// unknown scope.
func TestProviderCredentialRejectsInvalidInput(t *testing.T) {
	configPath := useConfigDir(t)
	writeCredentialCatalog(t, configPath, "http://127.0.0.1:1", "http://127.0.0.1:2/v1")
	storePath, err := config.DefaultCredentialStorePath()
	if err != nil {
		t.Fatal(err)
	}
	r := openRuntime(t, canonicalDir(t))

	if _, err := r.SaveProviderCredential("global", "missing", secretA); err == nil || !strings.Contains(err.Error(), "missing") {
		t.Fatalf("unknown provider: err=%v", err)
	}
	if _, err := r.GetProviderCredentialStatus("global", "missing"); err == nil || !strings.Contains(err.Error(), "missing") {
		t.Fatalf("unknown provider status: err=%v", err)
	}
	if _, err := r.RemoveProviderCredential("global", "missing"); err == nil {
		t.Fatal("unknown provider removal must fail")
	}
	for _, empty := range []string{"", "   \t"} {
		if _, err := r.SaveProviderCredential("global", "acme", empty); err == nil || !strings.Contains(err.Error(), "empty") {
			t.Fatalf("empty key %q: err=%v", empty, err)
		}
	}
	if _, err := r.SaveProviderCredential("bogus", "acme", secretA); err == nil || !strings.Contains(err.Error(), "scope") {
		t.Fatalf("bogus scope: err=%v", err)
	}
	if _, err := os.Stat(storePath); !os.IsNotExist(err) {
		t.Fatalf("rejected input must not write the store: %v", err)
	}
}

// A failed config save rolls the store back: a replaced key is restored to its previous value,
// and a first-time key is deleted again.
func TestSaveProviderCredentialRollsBackWhenConfigSaveFails(t *testing.T) {
	configPath := useConfigDir(t)
	dir := filepath.Dir(configPath)
	writeFile(t, configPath, `{
  "providers": {
    "acme": {"settings": {"baseURL": "http://127.0.0.1:2/v1"}, "models": {"m": {"limit": {"context": 1000, "output": 100}}}},
    "beta": {"settings": {"baseURL": "http://127.0.0.1:3/v1"}, "models": {"m": {"limit": {"context": 1000, "output": 100}}}}
  }
}`)
	// The rollback test needs a store that still writes while the configuration directory is
	// unwritable, so it uses the in-memory fake through the same seam.
	store := newFakeStore()
	r := openRuntimeWithStore(t, canonicalDir(t), store)

	// The replace case needs a previous value in the store.
	if _, err := r.SaveProviderCredential("global", "acme", secretA); err != nil {
		t.Fatal(err)
	}
	before := readFile(t, configPath)

	// With the configuration directory unwritable, config.Save fails after the store write.
	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })

	if _, err := r.SaveProviderCredential("global", "acme", secretB); err == nil {
		t.Fatal("the save must fail when the config file cannot be written")
	}
	if got, _ := store.Get(credentialName("global", "acme")); got != secretA {
		t.Fatalf("rollback must restore the previous value, got %q", got)
	}
	if _, err := r.SaveProviderCredential("global", "beta", secretC); err == nil {
		t.Fatal("the save must fail when the config file cannot be written")
	}
	if _, err := store.Get(credentialName("global", "beta")); !errors.Is(err, config.ErrCredentialNotFound) {
		t.Fatalf("rollback must delete a first-time key, got %v", err)
	}
	if onDisk := readFile(t, configPath); onDisk != before {
		t.Fatalf("the file must be unchanged by the failed saves: %s", onDisk)
	}
}
func TestCredentialNameShape(t *testing.T) {
	pattern := regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
	ids := []string{"acme", "deepseek", "a.b-c_d", "ümlaut", "a b", "a-b", strings.Repeat("long", 64)}
	for _, scope := range []string{"global", "workspace"} {
		for _, id := range ids {
			name := credentialName(scope, id)
			if !pattern.MatchString(name) {
				t.Fatalf("credentialName(%q,%q)=%q is outside Core's NAME pattern", scope, id, name)
			}
			if name != credentialName(scope, id) {
				t.Fatalf("credentialName(%q,%q) is not deterministic", scope, id)
			}
		}
	}
	if credentialName("global", "acme") == credentialName("workspace", "acme") {
		t.Fatal("the two scopes must derive different names")
	}
	if credentialName("global", "a b") == credentialName("global", "a-b") {
		t.Fatal("ids that sanitize alike must be separated by the hash suffix")
	}
}

// A package the dispatcher does not support is refused at save time with a clear error; the
// legacy ids normalize to openai-compatible; an absent DTO package preserves the file's.
func TestSaveProviderCatalogScopeValidatesPackage(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{
  "providers": {
    "an": {"package": "anthropic-messages", "settings": {"baseURL": "http://127.0.0.1:1"}, "models": {"m": {}}},
    "legacy": {"package": "@ai-sdk/openai-compatible", "settings": {"baseURL": "http://127.0.0.1:2/v1"}, "models": {"m": {}}}
  }
}`)
	r := openRuntime(t, canonicalDir(t))

	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	an := doc.Catalog.Providers["an"]
	an.Package = "grpc-vibes"
	doc.Catalog.Providers["an"] = an
	if _, err := r.SaveProviderCatalogScope("global", doc); err == nil ||
		!strings.Contains(err.Error(), "grpc-vibes") || !strings.Contains(err.Error(), "package") {
		t.Fatalf("unknown package: err=%v", err)
	}

	doc, err = r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	an = doc.Catalog.Providers["an"]
	an.Package = "anthropic-messages"
	doc.Catalog.Providers["an"] = an
	legacy := doc.Catalog.Providers["legacy"]
	legacy.Package = "@ai-sdk/openai-compatible"
	doc.Catalog.Providers["legacy"] = legacy
	saved, err := r.SaveProviderCatalogScope("global", doc)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Catalog.Providers["an"].Package != "anthropic-messages" {
		t.Fatalf("anthropic package=%q", saved.Catalog.Providers["an"].Package)
	}
	if saved.Catalog.Providers["legacy"].Package != "openai-compatible" {
		t.Fatalf("legacy package must normalize, got %q", saved.Catalog.Providers["legacy"].Package)
	}

	// An absent DTO package keeps the file's; a new provider defaults to the empty package.
	doc, err = r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	an = doc.Catalog.Providers["an"]
	an.Package = ""
	doc.Catalog.Providers["an"] = an
	doc.Catalog.Providers["fresh"] = ProviderDefinition{Settings: ProviderSettings{BaseURL: "http://127.0.0.1:4/v1"}, Models: map[string]ProviderModel{"m": {}}}
	saved, err = r.SaveProviderCatalogScope("global", doc)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Catalog.Providers["an"].Package != "anthropic-messages" {
		t.Fatalf("absent DTO package must preserve the file's, got %q", saved.Catalog.Providers["an"].Package)
	}
	if saved.Catalog.Providers["fresh"].Package != "" {
		t.Fatalf("a new provider's package must stay empty, got %q", saved.Catalog.Providers["fresh"].Package)
	}
}

// replyAnthropicText answers a Messages request with one streamed text block.
func replyAnthropicText(w http.ResponseWriter, text string) {
	w.Header().Set("Content-Type", "text/event-stream")
	fmt.Fprint(w, "event: message_start\n")
	fmt.Fprintf(w, `data: {"type":"message_start","message":{"usage":{"input_tokens":5}}}`+"\n\n")
	fmt.Fprint(w, `data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`+"\n\n")
	fmt.Fprintf(w, `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":%q}}`+"\n\n", text)
	fmt.Fprint(w, `data: {"type":"content_block_stop","index":0}`+"\n\n")
	fmt.Fprint(w, `data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}`+"\n\n")
	fmt.Fprint(w, `data: {"type":"message_stop"}`+"\n\n")
}

// The full-run leak proof: both protocols run end-to-end through the Desktop runtime with
// {secret:NAME} references, the wire auth of each protocol carries the key, and the value never
// appears in any returned JSON, event, log line, error, the configuration file, or anything at
// rest under the workspace or the configuration directory.
func TestProviderRunAndAPINeverLeakTheSecret(t *testing.T) {
	configPath := useConfigDir(t)

	var (
		mu            sync.Mutex
		anthropicKey  string
		anthropicAuth string
		anthropicVer  string
		anthropicPath string
		bearer        string
		oaPath        string
	)
	anthropic := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		mu.Lock()
		anthropicKey, anthropicAuth, anthropicVer, anthropicPath = req.Header.Get("x-api-key"), req.Header.Get("Authorization"), req.Header.Get("anthropic-version"), req.URL.Path
		mu.Unlock()
		replyAnthropicText(w, "anthropic reply")
	}))
	defer anthropic.Close()
	openai := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		mu.Lock()
		bearer, oaPath = req.Header.Get("Authorization"), req.URL.Path
		mu.Unlock()
		replyText(w, "openai reply")
	}))
	defer openai.Close()

	writeCredentialCatalog(t, configPath, anthropic.URL, openai.URL+"/v1")
	// The real default store, in the isolated global config dir useConfigDir set up: the run must
	// resolve {secret:NAME} exactly as production does, from credentials.json on disk.
	r := openRuntime(t, canonicalDir(t))

	// Capture the default logger and slog while the runs happen.
	var logBuf, slogBuf bytes.Buffer
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	previousSlog := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&slogBuf, nil)))
	t.Cleanup(func() { slog.SetDefault(previousSlog) })

	// Capture every event forwarded to the frontend.
	events, stop, ok := r.Events(512)
	if !ok {
		t.Fatal("no event stream")
	}
	var eventJSON []byte
	collectorDone := make(chan struct{})
	go func() {
		defer close(collectorDone)
		for event := range events {
			raw, err := json.Marshal(event)
			if err != nil {
				continue
			}
			eventJSON = append(eventJSON, raw...)
		}
	}()

	// Store both keys as the credential panel does.
	for _, provider := range []struct{ id, key string }{{"an", secretA}, {"acme", secretB}} {
		status, err := r.SaveProviderCredential("global", provider.id, provider.key)
		if err != nil {
			t.Fatal(err)
		}
		if !status.Set || status.Source != "stored" {
			t.Fatalf("%s status=%#v", provider.id, status)
		}
		if raw, _ := json.Marshal(status); strings.Contains(string(raw), provider.key) {
			t.Fatalf("%s status JSON carries the key", provider.id)
		}
	}

	ctx := context.Background()
	anSession, err := r.CreateSession(ctx, "anthropic run")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, anSession.ID, AgentConfig{ModelRef: "an/m", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitStatus(t, r, anSession.ID, "completed")

	oaSession, err := r.CreateSession(ctx, "openai run")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, oaSession.ID, AgentConfig{ModelRef: "acme/m", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitStatus(t, r, oaSession.ID, "completed")
	waitIdle(t, r, ctx)
	stop()
	<-collectorDone

	// The wire auth of each protocol carries the key and only that does.
	mu.Lock()
	if anthropicKey != secretA || anthropicAuth != "" || anthropicVer != "2023-06-01" || anthropicPath != "/v1/messages" {
		t.Fatalf("anthropic request: key=%q auth=%q version=%q path=%q", anthropicKey, anthropicAuth, anthropicVer, anthropicPath)
	}
	if bearer != "Bearer "+secretB || oaPath != "/v1/chat/completions" {
		t.Fatalf("openai request: bearer=%q path=%q", bearer, oaPath)
	}
	mu.Unlock()

	// Nothing returned to the UI carries either value.
	state, _ := r.ConfigState()
	doc, _ := r.ProviderCatalogScope("global")
	saved, _ := r.SaveProviderCatalogScope("global", doc)
	anStatus, _ := r.GetProviderCredentialStatus("global", "an")
	oaStatus, _ := r.GetProviderCredentialStatus("global", "acme")
	sessionInfo, _ := r.GetSession(ctx, anSession.ID)
	messages, _ := r.RecentMessages(ctx, anSession.ID, 50)
	for name, value := range map[string]any{
		"ConfigState":                state,
		"ProviderCatalogDocument":    doc,
		"saved":                      saved,
		"anthropic CredentialStatus": anStatus,
		"openai CredentialStatus":    oaStatus,
		"Session":                    sessionInfo,
		"Messages":                   messages,
	} {
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		for _, secret := range []string{secretA, secretB} {
			if strings.Contains(string(raw), secret) {
				t.Fatalf("%s JSON carries %q", name, secret)
			}
		}
	}

	// Neither log sink, no event and no file at rest carries either value — the credential store
	// file is the one sanctioned exception, and it must be exactly where Core puts it, 0600.
	for name, text := range map[string]string{"log": logBuf.String(), "slog": slogBuf.String(), "events": string(eventJSON)} {
		for _, secret := range []string{secretA, secretB} {
			if strings.Contains(text, secret) {
				t.Fatalf("%s output carries %q", name, secret)
			}
		}
	}
	home := filepath.Dir(filepath.Dir(configPath)) // the isolated XDG root
	storePath, err := config.DefaultCredentialStorePath()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(storePath, home) {
		t.Fatalf("the store must live under the isolated global config dir: %s", storePath)
	}
	assertNoSecretInTree(t, home, []string{secretA, secretB}, storePath)
	assertNoSecretInTree(t, r.currentWorkspace(), []string{secretA, secretB})
	if info, err := os.Stat(storePath); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("credentials.json must exist with mode 0600: %v %v", info, err)
	}
	if raw := readFile(t, storePath); !strings.Contains(raw, secretA) || !strings.Contains(raw, secretB) {
		t.Fatalf("the store file must hold both values for the runs to have worked: %s", raw)
	}
	if doc, _ := r.ProviderCatalogScope("global"); strings.Contains(fmt.Sprint(doc), secretA) || strings.Contains(fmt.Sprint(doc), secretB) {
		t.Fatal("the catalog document must never expose the store's contents")
	}
}

// assertNoSecretInTree fails when any file under root other than the exempted paths holds a value.
func assertNoSecretInTree(t *testing.T, root string, secrets []string, exempt ...string) {
	t.Helper()
	excluded := map[string]bool{}
	for _, path := range exempt {
		excluded[path] = true
	}
	_ = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() || excluded[path] {
			return err
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		for _, secret := range secrets {
			if bytes.Contains(raw, []byte(secret)) {
				t.Fatalf("%s holds the secret value at rest", path)
			}
		}
		return nil
	})
}

// Discovery and the connection test speak each protocol's auth, and an upstream that echoes the
// key in its error body gets it redacted out of every returned error.
func TestDiscoveryAndConnectionRedactEchoedKeys(t *testing.T) {
	configPath := useConfigDir(t)
	var (
		mu           sync.Mutex
		anthropicKey string
		bearer       string
		modelsPath   string
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		mu.Lock()
		anthropicKey, bearer, modelsPath = req.Header.Get("x-api-key"), req.Header.Get("Authorization"), req.URL.Path
		mu.Unlock()
		if strings.HasSuffix(req.URL.Path, "/models") && strings.Contains(req.URL.Path, "/echo-an/") {
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprintf(w, `{"error":{"message":"invalid api key %s"}}`, secretA)
			return
		}
		if strings.HasSuffix(req.URL.Path, "/models") && strings.Contains(req.URL.Path, "/echo-oa/") {
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprintf(w, `{"error":{"message":"invalid bearer %s"}}`, secretB)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"data":[{"id":"model-a"},{"id":"model-a"},{"id":"model-b"}]}`)
	}))
	defer server.Close()

	writeFile(t, configPath, fmt.Sprintf(`{
  "providers": {
    "ok-an": {"package": "anthropic-messages", "settings": {"baseURL": %q}, "models": {"m": {}}},
    "ok-oa": {"settings": {"baseURL": %q}, "models": {"m": {}}},
    "echo-an": {"package": "anthropic-messages", "settings": {"baseURL": %q}, "models": {"m": {}}},
    "echo-oa": {"settings": {"baseURL": %q}, "models": {"m": {}}}
  }
}`, server.URL+"/ok-an", server.URL+"/ok-oa/v1", server.URL+"/echo-an", server.URL+"/echo-oa/v1"))

	r := openRuntime(t, canonicalDir(t))
	for _, provider := range []struct{ id, key string }{{"ok-an", secretA}, {"ok-oa", secretB}, {"echo-an", secretA}, {"echo-oa", secretB}} {
		if _, err := r.SaveProviderCredential("global", provider.id, provider.key); err != nil {
			t.Fatal(err)
		}
	}

	// The success path: each protocol's own auth and models endpoint.
	if _, err := r.DiscoverProviderModels("ok-an"); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	if anthropicKey != secretA || bearer != "" || modelsPath != "/ok-an/v1/models" {
		t.Fatalf("anthropic discovery: key=%q bearer=%q path=%q", anthropicKey, bearer, modelsPath)
	}
	mu.Unlock()
	if _, err := r.DiscoverProviderModels("ok-oa"); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	if bearer != "Bearer "+secretB || modelsPath != "/ok-oa/v1/models" {
		t.Fatalf("openai discovery: bearer=%q path=%q", bearer, modelsPath)
	}
	mu.Unlock()
	result, err := r.TestProviderConnection("ok-an")
	if err != nil || !result.OK || result.Models != 2 || strings.Contains(result.Message, secretA) {
		t.Fatalf("result=%#v err=%v", result, err)
	}

	// Upstreams that echo the key in their error body: every returned error is redacted.
	for _, provider := range []struct{ id, key, label string }{
		{"echo-an", secretA, "x-api-key"},
		{"echo-oa", secretB, "Bearer"},
	} {
		_, err := r.DiscoverProviderModels(provider.id)
		if err == nil {
			t.Fatalf("%s: discovery must fail", provider.id)
		}
		if strings.Contains(err.Error(), provider.key) {
			t.Fatalf("%s error leaks the key: %v", provider.id, err)
		}
		if !strings.Contains(err.Error(), "[redacted]") {
			t.Fatalf("%s error must show the redacted excerpt: %v", provider.id, err)
		}
		_, err = r.TestProviderConnection(provider.id)
		if err == nil || strings.Contains(err.Error(), provider.key) {
			t.Fatalf("%s connection error leaks the key: %v", provider.id, err)
		}
	}
}

// The resolver maps the store contract onto Core's: a missing or empty secret is
// config.ErrCredentialNotFound, and a resolved value passes through unchanged.
func TestCredentialResolverContract(t *testing.T) {
	store := newFakeStore()
	resolver := credentialResolver{store: store}
	if _, err := resolver.Resolve("absent"); !errors.Is(err, config.ErrCredentialNotFound) {
		t.Fatalf("missing secret: %v", err)
	}
	if _, err := resolver.Resolve(""); !errors.Is(err, config.ErrCredentialNotFound) {
		t.Fatalf("empty name: %v", err)
	}
	if err := store.Set("present", secretA); err != nil {
		t.Fatal(err)
	}
	if v, err := resolver.Resolve("present"); err != nil || v != secretA {
		t.Fatalf("resolve: %q %v", v, err)
	}
}

// The single API key field: a ${NAME} (or {env:NAME}) placeholder switches the provider to an
// env reference and leaves nothing in the credential store; a literal goes to the store; the two
// replace each other in both directions; a value that only carries '$' or '{' in the middle is a
// literal like any other.
func TestSaveProviderCredentialSingleFieldClassification(t *testing.T) {
	configPath := useConfigDir(t)
	storePath, err := config.DefaultCredentialStorePath()
	if err != nil {
		t.Fatal(err)
	}
	writeCredentialCatalog(t, configPath, "http://127.0.0.1:1", "http://127.0.0.1:2/v1")
	r := openRuntime(t, canonicalDir(t))
	t.Setenv("LCX_PLACEHOLDER_KEY", "from-env")

	// Literal first: stored, and the store file holds the value.
	status, err := r.SaveProviderCredential("global", "acme", secretA)
	if err != nil {
		t.Fatal(err)
	}
	if status.Source != "stored" || !status.Set || status.Ref == "" {
		t.Fatalf("literal status=%#v", status)
	}
	if raw := readFile(t, storePath); !strings.Contains(raw, secretA) {
		t.Fatalf("the store must hold the literal: %s", raw)
	}

	// Placeholder replaces it: env reference in the file, nothing left in the store.
	status, err = r.SaveProviderCredential("global", "acme", "  ${LCX_PLACEHOLDER_KEY}  ")
	if err != nil {
		t.Fatal(err)
	}
	if status != (CredentialStatus{ProviderID: "acme", Scope: "global", Source: "env", Ref: "{env:LCX_PLACEHOLDER_KEY}", Set: true}) {
		t.Fatalf("placeholder status=%#v", status)
	}
	if onDisk := readFile(t, configPath); !strings.Contains(onDisk, "{env:LCX_PLACEHOLDER_KEY}") || strings.Contains(onDisk, "{secret:") {
		t.Fatalf("the file must carry the env reference and no secret reference: %s", onDisk)
	}
	if raw := readFile(t, storePath); strings.Contains(raw, secretA) {
		t.Fatalf("no stored key may survive the switch: %s", raw)
	}

	// The Core-native form is the same placeholder.
	if status, err = r.SaveProviderCredential("global", "acme", "{env:LCX_PLACEHOLDER_KEY}"); err != nil ||
		status.Source != "env" || status.Ref != "{env:LCX_PLACEHOLDER_KEY}" {
		t.Fatalf("core-native form: %#v %v", status, err)
	}

	// Back to a literal: stored again, env reference gone.
	if status, err = r.SaveProviderCredential("global", "acme", secretB); err != nil || status.Source != "stored" || !status.Set {
		t.Fatalf("back to literal: %#v %v", status, err)
	}
	if onDisk := readFile(t, configPath); strings.Contains(onDisk, "{env:LCX_PLACEHOLDER_KEY}") {
		t.Fatalf("the env reference must be gone: %s", onDisk)
	}
	if raw := readFile(t, storePath); !strings.Contains(raw, secretB) || strings.Contains(raw, secretA) {
		t.Fatalf("the store must hold only the new literal: %s", raw)
	}

	// A literal that merely contains '$' or '{' in the middle is a literal like any other.
	literal := "sk-live-abc${XYZ}tail{env:FOO}mid"
	if status, err = r.SaveProviderCredential("global", "acme", literal); err != nil || status.Source != "stored" || !status.Set {
		t.Fatalf("dollar-brace literal: %#v %v", status, err)
	}
	if raw := readFile(t, storePath); !strings.Contains(raw, literal) {
		t.Fatalf("the store must hold the literal verbatim: %s", raw)
	}
}

// Values that look like a placeholder or a {secret:..} reference but are not a valid one are
// refused, the error names only the shape, and neither the configuration nor the store changes.
func TestSaveProviderCredentialRejectsInvalidPlaceholders(t *testing.T) {
	configPath := useConfigDir(t)
	storePath, err := config.DefaultCredentialStorePath()
	if err != nil {
		t.Fatal(err)
	}
	writeCredentialCatalog(t, configPath, "http://127.0.0.1:1", "http://127.0.0.1:2/v1")
	r := openRuntime(t, canonicalDir(t))

	// A stored literal and its reference must survive every rejected input untouched.
	if _, err := r.SaveProviderCredential("global", "acme", secretA); err != nil {
		t.Fatal(err)
	}
	beforeConfig := readFile(t, configPath)
	beforeStore := readFile(t, storePath)

	for _, invalid := range []string{
		"${A B}", "${NAME:default}", "${}", "${1abc}", "${under_score-ok}", "${NAME",
		"{env:1BAD}", "{env:}", "{env:NAME}extra", "{secret:x}", "{secret:valid-name}", "{secret:}",
	} {
		status, err := r.SaveProviderCredential("global", "acme", invalid)
		if err == nil {
			t.Fatalf("%q must be rejected, got %#v", invalid, status)
		}
		if !strings.Contains(err.Error(), "not accepted") {
			t.Fatalf("%q error must name the problem: %v", invalid, err)
		}
		// The error never echoes the typed text beyond the shape names it explains.
		if strings.Contains(err.Error(), invalid) && !isShapeName(invalid) {
			t.Fatalf("%q error echoes the rejected value: %v", invalid, err)
		}
		if invalid == "${NAME:default}" && strings.Contains(err.Error(), "NAME:default") {
			t.Fatalf("the default example must not echo the typed text: %v", err)
		}
	}
	if after := readFile(t, configPath); after != beforeConfig {
		t.Fatalf("rejected input changed the configuration:\n%s", after)
	}
	if after := readFile(t, storePath); after != beforeStore {
		t.Fatalf("rejected input changed the store:\n%s", after)
	}
}

// A delete failure while switching to an env reference rolls the configuration back: the file
// keeps the previous {secret:..} reference and the stored key stays, so the switch is
// all-or-nothing.
func TestSaveProviderCredentialEnvSwitchRollsBackWhenDeleteFails(t *testing.T) {
	configPath := useConfigDir(t)
	writeCredentialCatalog(t, configPath, "http://127.0.0.1:1", "http://127.0.0.1:2/v1")
	store := &failingDeleteStore{items: map[string]string{}}
	r := openRuntimeWithStore(t, canonicalDir(t), store)

	if _, err := r.SaveProviderCredential("global", "acme", secretA); err != nil {
		t.Fatal(err)
	}
	before := readFile(t, configPath)

	store.fail = true
	if _, err := r.SaveProviderCredential("global", "acme", "${LCX_ANY_KEY}"); err == nil {
		t.Fatal("the switch must fail when the stored key cannot be deleted")
	}
	if after := readFile(t, configPath); after != before {
		t.Fatalf("the configuration must be rolled back:\n%s", after)
	}
	if v, _ := store.Get(credentialName("global", "acme")); v != secretA {
		t.Fatalf("the stored key must survive the failed switch: %q", v)
	}
}

// isShapeName reports whether value is one of the reference shapes the error text names.
func isShapeName(value string) bool {
	for _, shape := range []string{"${NAME}", "${NAME:value}", "{env:NAME}", "{secret:NAME}"} {
		if strings.Contains(shape, value) {
			return true
		}
	}
	return false
}

// failingDeleteStore wraps the fake store with a Delete that fails on demand.
type failingDeleteStore struct {
	items map[string]string
	fail  bool
}

func (f *failingDeleteStore) Set(name, secret string) error {
	f.items[name] = secret
	return nil
}

func (f *failingDeleteStore) Get(name string) (string, error) {
	v, ok := f.items[name]
	if !ok {
		return "", fmt.Errorf("%w: %s", config.ErrCredentialNotFound, name)
	}
	return v, nil
}

func (f *failingDeleteStore) Delete(name string) error {
	if f.fail {
		return errors.New("store is locked")
	}
	delete(f.items, name)
	return nil
}
