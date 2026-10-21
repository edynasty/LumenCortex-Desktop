package main

import (
	"reflect"
	"testing"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
)

func subMenu(t *testing.T, m *menu.Menu, label string) *menu.Menu {
	t.Helper()
	for _, item := range m.Items {
		if item.Label == label && item.SubMenu != nil {
			return item.SubMenu
		}
	}
	t.Fatalf("no submenu %q", label)
	return nil
}

func accelerator(item *menu.MenuItem) string {
	if item.Accelerator == nil {
		return ""
	}
	return keys.Stringify(item.Accelerator, "darwin")
}

// The menu bar is App (system), File, Edit (system), View, Window (system); the custom items carry
// the shortcuts the webview used to own, and choosing one emits exactly its command.
func TestMenuStructureAndCommands(t *testing.T) {
	var emitted []string
	closed := 0
	m := buildMenu("en", func(c string) { emitted = append(emitted, c) }, func() { closed++ })

	var top []string
	for _, item := range m.Items {
		switch item.Role {
		case menu.AppMenuRole:
			top = append(top, "role:app")
		case menu.EditMenuRole:
			top = append(top, "role:edit")
		case menu.WindowMenuRole:
			top = append(top, "role:window")
		default:
			top = append(top, item.Label)
		}
	}
	if want := []string{"role:app", "File", "role:edit", "View", "role:window"}; !reflect.DeepEqual(top, want) {
		t.Fatalf("menu bar = %v, want %v", top, want)
	}

	type entry struct{ label, accel, command string }
	var got []entry
	for _, name := range []string{"File", "View"} {
		for _, item := range subMenu(t, m, name).Items {
			if item.IsSeparator() {
				continue
			}
			before := len(emitted)
			item.Click(&menu.CallbackData{MenuItem: item})
			command := ""
			if len(emitted) > before {
				command = emitted[len(emitted)-1]
			}
			got = append(got, entry{item.Label, accelerator(item), command})
		}
	}
	want := []entry{
		{"New Thread", "Cmd+N", menuCommandNewThread},
		{"Settings…", "Cmd+,", menuCommandSettings},
		{"Close Window", "Cmd+W", ""},
		{"Command Palette", "Cmd+K", menuCommandPalette},
		{"Toggle Sidebar", "Cmd+B", menuCommandToggleSidebar},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("items = %+v\nwant   %+v", got, want)
	}
	if closed != 1 {
		t.Fatalf("Close Window ran closeWindow %d times, want once and without emitting a command", closed)
	}
}

func TestMenuFollowsTheAppLanguage(t *testing.T) {
	m := buildMenu("zh-CN", func(string) {}, func() {})
	subMenu(t, m, "文件")
	subMenu(t, m, "视图")
	// Anything that is not English is the default language.
	if menuLabelsFor("") != menuLabelsFor("zh-CN") || menuLabelsFor("fr") != menuLabelsFor("zh-CN") {
		t.Fatal("unknown locales must fall back to Chinese")
	}
}

func TestWindowGroundFollowsSystemAppearance(t *testing.T) {
	cases := []struct {
		raw  string
		ok   bool
		want any
	}{
		{"Dark\n", true, windowGroundDark},
		{"dark", true, windowGroundDark},
		{"", false, windowGroundLight}, // light mode: the key is absent and the read fails
		{"Dark\n", false, windowGroundLight},
		{"Light\n", true, windowGroundLight},
	}
	for _, c := range cases {
		if got := windowGroundFor(c.raw, c.ok); got != c.want {
			t.Errorf("windowGroundFor(%q, %v) = %+v, want %+v", c.raw, c.ok, got, c.want)
		}
	}
}
