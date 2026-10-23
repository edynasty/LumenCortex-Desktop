package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// eventSink collects the manager's emitted events so a test can read pty output without a window.
type eventSink struct {
	mu      sync.Mutex
	outputs map[string][]byte
	exits   map[string]int
}

func newEventSink() *eventSink {
	return &eventSink{outputs: map[string][]byte{}, exits: map[string]int{}}
}

func (s *eventSink) emit(event string, payload any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	switch value := payload.(type) {
	case TerminalOutput:
		data, err := base64.StdEncoding.DecodeString(value.Data)
		if err != nil {
			return
		}
		s.outputs[value.ID] = append(s.outputs[value.ID], data...)
	case TerminalExit:
		s.exits[value.ID] = value.Code
	}
}

func (s *eventSink) output(id string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return string(s.outputs[id])
}

func (s *eventSink) exited(id string) (int, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	code, ok := s.exits[id]
	return code, ok
}

func waitFor(t *testing.T, description string, check func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if check() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", description)
}

func testTerminalManager(t *testing.T) (*terminalManager, *eventSink) {
	t.Helper()
	sink := newEventSink()
	manager := newTerminalManager(sink.emit)
	manager.shell = "/bin/sh"
	manager.shellArgs = []string{"-l"}
	return manager, sink
}

func TestTerminalRunsACommandInItsDirectory(t *testing.T) {
	manager, sink := testTerminalManager(t)
	dir := t.TempDir()
	id, err := manager.Start(dir, 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	defer manager.CloseAll()
	if err := manager.Write(id, "echo marker-$((40+2))\n"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "the shell's echo", func() bool { return strings.Contains(sink.output(id), "marker-42") })

	if err := manager.Resize(id, 120, 40); err != nil {
		t.Fatal(err)
	}
	if err := manager.Close(id); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "the exit event", func() bool {
		_, ok := sink.exited(id)
		return ok
	})
	if err := manager.Write(id, "echo late\n"); err == nil {
		t.Fatal("writing to a closed terminal should fail")
	}
	if err := manager.Close(id); err == nil {
		t.Fatal("closing a closed terminal should fail")
	}
}

func TestTerminalStartsInTheRequestedDirectory(t *testing.T) {
	manager, sink := testTerminalManager(t)
	dir := t.TempDir()
	id, err := manager.Start(dir, 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	defer manager.CloseAll()
	if err := manager.Write(id, "pwd\n"); err != nil {
		t.Fatal(err)
	}
	real, err := filepath.EvalSymlinks(dir)
	if err != nil {
		t.Fatal(err)
	}
	waitFor(t, "pwd", func() bool { return strings.Contains(sink.output(id), real) })
}

func TestTerminalRefusesMoreThanItsBound(t *testing.T) {
	manager, _ := testTerminalManager(t)
	manager.max = 1
	defer manager.CloseAll()
	if _, err := manager.Start(t.TempDir(), 80, 24); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Start(t.TempDir(), 80, 24); err == nil {
		t.Fatal("a second terminal over the bound should be refused")
	}
}

func TestTerminalRefusesAMissingDirectory(t *testing.T) {
	manager, _ := testTerminalManager(t)
	if _, err := manager.Start(filepath.Join(t.TempDir(), "missing"), 80, 24); err == nil {
		t.Fatal("a missing cwd should fail")
	}
	file := filepath.Join(t.TempDir(), "file.txt")
	if err := os.WriteFile(file, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Start(file, 80, 24); err == nil {
		t.Fatal("a file as cwd should fail")
	}
}

func TestTerminalCloseAllStopsEveryShell(t *testing.T) {
	manager, sink := testTerminalManager(t)
	first, err := manager.Start(t.TempDir(), 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	second, err := manager.Start(t.TempDir(), 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	manager.CloseAll()
	waitFor(t, "both exits", func() bool {
		_, firstDone := sink.exited(first)
		_, secondDone := sink.exited(second)
		return firstDone && secondDone
	})
	manager.mu.Lock()
	remaining := len(manager.sessions)
	manager.mu.Unlock()
	if remaining != 0 {
		t.Fatalf("%d terminals remain", remaining)
	}
}
