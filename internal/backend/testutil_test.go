package backend

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

// originalHome is the HOME TestMain replaced, for the one test that talks to the user's real
// Keychain (the store looks up the login keychain through HOME, and the app always runs with the
// user's real one).
var originalHome = os.Getenv("HOME")

// TestMain points the package at a private HOME and configuration directory, so no test reads or
// writes the developer's lumencortex.json, mcp.json or skills, and clears the variables the earlier
// provider path read.
func TestMain(m *testing.M) {
	home, err := os.MkdirTemp("", "lcx-desktop-test-")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if resolved, err := filepath.EvalSymlinks(home); err == nil {
		home = resolved
	}
	isolateEnv(home)
	code := m.Run()
	os.RemoveAll(home)
	os.Exit(code)
}

func isolateEnv(home string) {
	os.Setenv("HOME", home)
	os.Setenv("USERPROFILE", home)
	os.Setenv("XDG_CONFIG_HOME", filepath.Join(home, "xdg"))
	os.Setenv("XDG_CACHE_HOME", filepath.Join(home, "cache"))
	for _, name := range []string{"LCX_MODEL", "LCX_ENDPOINT", "LCX_BASE_URL", "LCX_API_KEY", "LCX_REASONING_FORMAT"} {
		os.Unsetenv(name)
	}
}

// useConfigDir gives the test its own empty global configuration directory and returns the path of
// its lumencortex.json.
func useConfigDir(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	if resolved, err := filepath.EvalSymlinks(home); err == nil {
		home = resolved
	}
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, "xdg"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(home, "cache"))
	return filepath.Join(home, "xdg", "lumencortex", "lumencortex.json")
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// writeTestCatalog writes a global catalog with the models test/a and test/b, both served by
// baseURL, whose default model is def.
func writeTestCatalog(t *testing.T, path, baseURL, def string) {
	t.Helper()
	writeFile(t, path, fmt.Sprintf(`{
  "model": %q,
  "providers": {
    "test": {
      "name": "Test",
      "settings": {"baseURL": %q},
      "models": {
        "a": {"name": "Model A", "modelID": "upstream-a", "limit": {"context": 65536, "output": 8192}},
        "b": {"name": "Model B", "modelID": "upstream-b", "limit": {"context": 65536, "output": 8192}}
      }
    }
  }
}
`, def, baseURL))
}

// replyText answers a chat completion with a streamed assistant message.
func replyText(w http.ResponseWriter, text string) {
	w.Header().Set("Content-Type", "text/event-stream")
	fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":%q},\"finish_reason\":null}]}\n\n", text)
	fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2,\"total_tokens\":5}}\n\n")
	fmt.Fprint(w, "data: [DONE]\n\n")
}

// replyToolCall answers a chat completion with one streamed tool call.
func replyToolCall(w http.ResponseWriter, id, name, arguments string) {
	w.Header().Set("Content-Type", "text/event-stream")
	fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\",\"tool_calls\":[{\"index\":0,\"id\":%q,\"type\":\"function\",\"function\":{\"name\":%q,\"arguments\":%q}}]},\"finish_reason\":null}]}\n\n", id, name, arguments)
	fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\n")
	fmt.Fprint(w, "data: [DONE]\n\n")
}
