package main

import (
	"context"
	"strings"
	"testing"
)

// ⌘Q with nothing running quits at once; a run in flight asks first, and only a confirmed quit
// proceeds. onBeforeClose returns true to prevent the quit.
func TestQuitAsksOnlyWhileARunIsInFlight(t *testing.T) {
	cases := []struct {
		name    string
		active  int
		confirm bool
		asked   bool
		prevent bool
	}{
		{name: "no run quits at once", active: 0},
		{name: "a run, kept running", active: 2, confirm: false, asked: true, prevent: true},
		{name: "a run, quit anyway", active: 1, confirm: true, asked: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			app := &App{ctx: context.Background()}
			asked := 0
			app.activeRuns = func() int { return c.active }
			app.askToQuit = func(active int) bool {
				asked++
				if active != c.active {
					t.Errorf("asked with %d runs, want %d", active, c.active)
				}
				return c.confirm
			}
			if prevent := app.onBeforeClose(context.Background()); prevent != c.prevent {
				t.Fatalf("prevent=%v, want %v", prevent, c.prevent)
			}
			if (asked > 0) != c.asked {
				t.Fatalf("asked %d times, want asked=%v", asked, c.asked)
			}
		})
	}
}

// Before startup there is no window to ask with, so the quit is never blocked.
func TestQuitBeforeStartupIsNotBlocked(t *testing.T) {
	app := &App{}
	app.activeRuns = func() int { return 3 }
	app.askToQuit = func(int) bool {
		t.Fatal("the quit dialog must not be attempted before startup")
		return false
	}
	if app.onBeforeClose(context.Background()) {
		t.Fatal("a quit before startup must not be prevented")
	}
}

// The prompt follows the menu language, names the run count, and defaults to Chinese like the menu.
func TestQuitPromptFollowsTheMenuLanguage(t *testing.T) {
	en := quitPromptFor("en")
	zh := quitPromptFor(defaultMenuLocale)
	if en.title == zh.title || en.quit == zh.quit || en.cancel == zh.cancel {
		t.Fatalf("English and Chinese prompts share copy: %#v %#v", en, zh)
	}
	for _, prompt := range []quitPrompt{en, zh} {
		if !strings.Contains(prompt.message, "{count}") {
			t.Errorf("prompt %q does not carry the run count", prompt.message)
		}
		if prompt.quit == prompt.cancel {
			t.Errorf("prompt buttons are indistinguishable: %#v", prompt)
		}
	}
	if quitPromptFor("fr") != zh {
		t.Fatal("an unknown locale must fall back to Chinese")
	}
}

// No workspace and no engine is no run: the quit is not held up by an app that never opened a project.
func TestActiveRunCountWithoutAWorkspace(t *testing.T) {
	app := NewApp()
	t.Cleanup(func() { _ = app.backend.Close() })
	if got := app.countActiveRuns(); got != 0 {
		t.Fatalf("active runs=%d, want 0", got)
	}
	if got := app.menuLanguage(); got != defaultMenuLocale {
		t.Fatalf("menu language=%q, want %q", got, defaultMenuLocale)
	}
}
