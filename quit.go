package main

import (
	"context"
	"log"
	"strconv"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// quitPrompt is the native confirmation shown when quitting would abandon a run. It follows the
// menu language: the dialog is part of the same native chrome.
type quitPrompt struct{ title, message, cancel, quit string }

func quitPromptFor(locale string) quitPrompt {
	if locale == "en" {
		return quitPrompt{
			title:   "Quit LumenCortex?",
			message: "Agent runs still in progress: {count}. Quitting stops them.",
			cancel:  "Keep Running",
			quit:    "Quit Anyway",
		}
	}
	return quitPrompt{
		title:   "退出 LumenCortex？",
		message: "还有 {count} 个任务在运行，退出会中止它们。",
		cancel:  "继续运行",
		quit:    "仍然退出",
	}
}

// onBeforeClose runs before the app quits — ⌘Q, the App menu, or closing the only window, which
// Wails routes to the same quit request. A run in progress asks first, so quitting cannot abandon
// work silently; with no run, or when the caller cannot ask, the quit proceeds.
func (a *App) onBeforeClose(context.Context) bool {
	if a.ctx == nil || a.activeRuns == nil || a.askToQuit == nil {
		return false
	}
	active := a.activeRuns()
	if active == 0 {
		return false
	}
	return !a.askToQuit(active)
}

// countActiveRuns is how many runs are in flight. An unreadable state counts as none: a broken
// engine must not make the app impossible to quit.
func (a *App) countActiveRuns() int {
	state, err := a.backend.State(context.Background())
	if err != nil {
		return 0
	}
	return len(state.ActiveRuns)
}

// confirmQuit shows the native question and reports whether the user chose to quit. A dialog that
// cannot be shown does not block the quit: the user asked to leave, and there may be no window
// server to ask with.
func (a *App) confirmQuit(activeRuns int) bool {
	prompt := quitPromptFor(a.menuLanguage())
	choice, err := wailsruntime.MessageDialog(a.ctx, wailsruntime.MessageDialogOptions{
		Type:          wailsruntime.QuestionDialog,
		Title:         prompt.title,
		Message:       strings.ReplaceAll(prompt.message, "{count}", strconv.Itoa(activeRuns)),
		Buttons:       []string{prompt.cancel, prompt.quit},
		DefaultButton: prompt.cancel,
		CancelButton:  prompt.cancel,
	})
	if err != nil {
		log.Printf("quit confirmation unavailable: %v", err)
		return true
	}
	return choice == prompt.quit
}

// menuLanguage is the language the native chrome is in; the quit dialog follows it.
func (a *App) menuLanguage() string {
	a.menuMu.Lock()
	defer a.menuMu.Unlock()
	if a.menuLocale == "" {
		return defaultMenuLocale
	}
	return a.menuLocale
}
