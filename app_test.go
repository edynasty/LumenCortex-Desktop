package main

import (
	"os"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/edynasty/LumenCortex-Desktop/internal/backend"
)

// The frontend calls the Go App only through AppAPI in frontend/src/lib/bridge.ts, and its wire
// types live in frontend/src/types.ts. These tests keep both in step with the bound Go methods and
// DTOs, which Wails would otherwise only reveal at runtime.

func readSource(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

type tsMethod struct {
	params  int
	returns string
}

func parseAppAPI(t *testing.T) map[string]tsMethod {
	t.Helper()
	src := readSource(t, "frontend/src/lib/bridge.ts")
	start := strings.Index(src, "type AppAPI = {")
	end := strings.Index(src[start:], "\n};")
	if start < 0 || end < 0 {
		t.Fatal("AppAPI not found in bridge.ts")
	}
	line := regexp.MustCompile(`(?m)^  ([A-Z]\w*)\((.*)\): Promise<(.*)>;$`)
	out := map[string]tsMethod{}
	for _, m := range line.FindAllStringSubmatch(src[start:start+end], -1) {
		out[m[1]] = tsMethod{params: countParams(m[2]), returns: m[3]}
	}
	if len(out) == 0 {
		t.Fatal("no AppAPI methods parsed")
	}
	return out
}

func countParams(list string) int {
	if strings.TrimSpace(list) == "" {
		return 0
	}
	depth, n := 0, 1
	for _, r := range list {
		switch r {
		case '<', '(', '[', '{':
			depth++
		case '>', ')', ']', '}':
			depth--
		case ',':
			if depth == 0 {
				n++
			}
		}
	}
	return n
}

func TestBridgeDeclaresExactlyTheBoundAppMethods(t *testing.T) {
	declared := parseAppAPI(t)
	app := reflect.TypeOf(&App{})
	bound := map[string]reflect.Method{}
	for i := range app.NumMethod() {
		bound[app.Method(i).Name] = app.Method(i)
	}
	var names []string
	for name := range bound {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		method := bound[name]
		ts, ok := declared[name]
		if !ok {
			t.Errorf("App.%s is bound but missing from AppAPI in bridge.ts", name)
			continue
		}
		if got := method.Type.NumIn() - 1; got != ts.params {
			t.Errorf("App.%s takes %d parameters in Go, %d in AppAPI", name, got, ts.params)
		}
		returnsValue := method.Type.NumOut() == 2 || (method.Type.NumOut() == 1 && method.Type.Out(0).Name() != "error")
		if returnsValue == (ts.returns == "void") {
			t.Errorf("App.%s returns a value in Go: %v; AppAPI says Promise<%s>", name, returnsValue, ts.returns)
		}
	}
	for name := range declared {
		if _, ok := bound[name]; !ok {
			t.Errorf("AppAPI declares %s, which App does not bind", name)
		}
	}
	for _, removed := range []string{"GetProviderCatalog", "SaveProviderCatalog"} {
		if _, ok := declared[removed]; ok {
			t.Errorf("AppAPI still declares %s", removed)
		}
		if _, ok := bound[removed]; ok {
			t.Errorf("App still binds %s", removed)
		}
	}
	for _, added := range []string{"GetConfigState", "TrustWorkspace"} {
		if _, ok := bound[added]; !ok {
			t.Errorf("App does not bind %s", added)
		}
	}
}

// tsFields returns the fields of `export type name = { ... };` and whether each is optional.
func tsFields(t *testing.T, src, name string) map[string]bool {
	t.Helper()
	header := "export type " + name + " = {"
	start := strings.Index(src, header)
	if start < 0 {
		t.Fatalf("types.ts has no type %s", name)
	}
	rest := src[start+len(header):]
	end := strings.Index(rest, "\n};")
	if end < 0 {
		t.Fatalf("type %s is not closed", name)
	}
	field := regexp.MustCompile(`(?m)^  ([\w$]+)(\?)?:`)
	out := map[string]bool{}
	for _, m := range field.FindAllStringSubmatch(rest[:end], -1) {
		out[m[1]] = m[2] == "?"
	}
	return out
}

func goFields(typ reflect.Type) map[string]bool {
	out := map[string]bool{}
	for i := range typ.NumField() {
		tag := typ.Field(i).Tag.Get("json")
		if tag == "" || tag == "-" {
			continue
		}
		name, opts, _ := strings.Cut(tag, ",")
		out[name] = strings.Contains(opts, "omitempty")
	}
	return out
}

func TestWireTypesMatchGoDTOs(t *testing.T) {
	src := readSource(t, "frontend/src/types.ts")
	for name, typ := range map[string]reflect.Type{
		"ConfigState":             reflect.TypeOf(backend.ConfigState{}),
		"ModelInfo":               reflect.TypeOf(backend.ModelInfo{}),
		"ConfigWarning":           reflect.TypeOf(backend.ConfigWarning{}),
		"ProviderCatalogDocument": reflect.TypeOf(backend.ProviderCatalogDocument{}),
		"ProviderCatalog":         reflect.TypeOf(backend.ProviderCatalog{}),
		"ProviderDefinition":      reflect.TypeOf(backend.ProviderDefinition{}),
		"ProviderModel":           reflect.TypeOf(backend.ProviderModel{}),
		"AgentConfig":             reflect.TypeOf(backend.AgentConfig{}),
	} {
		ts, goSide := tsFields(t, src, name), goFields(typ)
		if !reflect.DeepEqual(ts, goSide) {
			t.Errorf("%s: types.ts fields %v differ from the Go JSON fields %v (value = optional)", name, ts, goSide)
		}
	}
	session := tsFields(t, src, "Session")
	if _, ok := session["modelRef"]; !ok {
		t.Error("Session in types.ts lacks modelRef, which Core's SessionInfo carries")
	}
	if _, ok := goFields(reflect.TypeOf(backend.Session{}))["modelRef"]; !ok {
		t.Error("Core's SessionInfo has no modelRef")
	}
	for _, removed := range []string{"ProviderConfig"} {
		if strings.Contains(src, "export type "+removed+" =") {
			t.Errorf("types.ts still declares %s", removed)
		}
	}
	if fields := tsFields(t, src, "AgentConfig"); fields["provider"] != false {
		if _, ok := fields["provider"]; ok {
			t.Error("AgentConfig still carries a provider")
		}
	}
}
