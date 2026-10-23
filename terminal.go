package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
)

// The terminal is Desktop-native integration: Core owns sessions, files and runs, while a real
// interactive shell belongs to the window the user types into. One manager owns every pty of the
// app; the frontend drives it through TerminalStart/Write/Resize/Close and receives output and
// exit notices as Wails events.
const (
	terminalOutputEvent = "terminal:output"
	terminalExitEvent   = "terminal:exit"

	// maxTerminals bounds how many shells one app may keep: each is a process tree, and the
	// inspector opens one per workspace.
	maxTerminals = 8

	// Output is batched: a chunk is sent when it reaches this size or when the timer fires,
	// whichever comes first, so a fast command does not emit thousands of tiny events.
	terminalBatchBytes = 64 << 10
	terminalBatchDelay = 12 * time.Millisecond

	// After the pty is closed the shell usually exits on SIGHUP; a shell that ignores it is
	// killed once this grace period passes.
	terminalKillDelay = 2 * time.Second
)

// TerminalOutput is one batched chunk of pty output. Data is base64: pty bytes are not always
// valid UTF-8, and a JSON string would silently replace the invalid parts.
type TerminalOutput struct {
	ID   string `json:"id"`
	Data string `json:"data"`
}

// TerminalExit reports the shell's exit; the terminal id is no longer usable afterwards.
type TerminalExit struct {
	ID   string `json:"id"`
	Code int    `json:"code"`
}

type terminalSession struct {
	id   string
	cmd  *exec.Cmd
	file *os.File

	closeOnce sync.Once
	mu        sync.Mutex
	killTimer *time.Timer
}

type terminalManager struct {
	mu       sync.Mutex
	sessions map[string]*terminalSession
	seq      int
	max      int
	emit     func(event string, payload any)

	// shell and shellArgs are the user's login shell; tests replace them with a known binary.
	shell     string
	shellArgs []string
}

func newTerminalManager(emit func(string, any)) *terminalManager {
	return &terminalManager{
		sessions:  map[string]*terminalSession{},
		max:       maxTerminals,
		emit:      emit,
		shellArgs: []string{"-l"},
	}
}

// Start opens one shell in cwd and returns its id. cwd must already be confined to the workspace
// by the caller; the manager only checks that it is a directory.
func (m *terminalManager) Start(cwd string, cols, rows int) (string, error) {
	info, err := os.Stat(cwd)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("terminal cwd is not a directory: %s", cwd)
	}

	m.mu.Lock()
	if len(m.sessions) >= m.max {
		m.mu.Unlock()
		return "", fmt.Errorf("too many terminals (limit %d)", m.max)
	}
	m.seq++
	id := fmt.Sprintf("term-%d", m.seq)
	m.mu.Unlock()

	command := m.command()
	cmd := exec.Command(command[0], command[1:]...)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	file, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: dimension(rows, 24), Cols: dimension(cols, 80)})
	if err != nil {
		return "", err
	}
	session := &terminalSession{id: id, cmd: cmd, file: file}

	m.mu.Lock()
	m.sessions[id] = session
	m.mu.Unlock()

	go m.pump(session)
	return id, nil
}

// command is the login shell: $SHELL when set, /bin/zsh otherwise, started as a login shell so
// the user's PATH and shell configuration match a normal terminal window.
func (m *terminalManager) command() []string {
	shell := m.shell
	if shell == "" {
		shell = os.Getenv("SHELL")
	}
	if shell == "" {
		shell = "/bin/zsh"
	}
	return append([]string{shell}, m.shellArgs...)
}

func (m *terminalManager) Write(id, data string) error {
	session, err := m.session(id)
	if err != nil {
		return err
	}
	_, err = session.file.WriteString(data)
	return err
}

func (m *terminalManager) Resize(id string, cols, rows int) error {
	session, err := m.session(id)
	if err != nil {
		return err
	}
	return pty.Setsize(session.file, &pty.Winsize{Rows: dimension(rows, 24), Cols: dimension(cols, 80)})
}

func (m *terminalManager) Close(id string) error {
	m.mu.Lock()
	session := m.sessions[id]
	delete(m.sessions, id)
	m.mu.Unlock()
	if session == nil {
		return fmt.Errorf("unknown terminal: %s", id)
	}
	session.stop()
	return nil
}

// CloseAll stops every shell; the app calls it on shutdown and when the workspace changes.
func (m *terminalManager) CloseAll() {
	m.mu.Lock()
	sessions := make([]*terminalSession, 0, len(m.sessions))
	for _, session := range m.sessions {
		sessions = append(sessions, session)
	}
	m.sessions = map[string]*terminalSession{}
	m.mu.Unlock()
	for _, session := range sessions {
		session.stop()
	}
}

func (m *terminalManager) session(id string) (*terminalSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	session := m.sessions[id]
	if session == nil {
		return nil, fmt.Errorf("unknown terminal: %s", id)
	}
	return session, nil
}

func (s *terminalSession) stop() {
	s.closeOnce.Do(func() {
		_ = s.file.Close()
		if s.cmd.Process == nil {
			return
		}
		timer := time.AfterFunc(terminalKillDelay, func() {
			_ = s.cmd.Process.Kill()
		})
		s.mu.Lock()
		s.killTimer = timer
		s.mu.Unlock()
	})
}

func (s *terminalSession) cancelKill() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.killTimer != nil {
		s.killTimer.Stop()
		s.killTimer = nil
	}
}

// pump reads the pty until it closes, batches the bytes and reports the exit once the process is
// reaped.
func (m *terminalManager) pump(s *terminalSession) {
	chunks := make(chan []byte, 64)
	go func() {
		defer close(chunks)
		buf := make([]byte, 32<<10)
		for {
			n, err := s.file.Read(buf)
			if n > 0 {
				chunk := make([]byte, n)
				copy(chunk, buf[:n])
				chunks <- chunk
			}
			if err != nil {
				return
			}
		}
	}()

	ticker := time.NewTicker(terminalBatchDelay)
	defer ticker.Stop()
	pending := make([]byte, 0, terminalBatchBytes)
	flush := func() {
		if len(pending) == 0 {
			return
		}
		data := base64.StdEncoding.EncodeToString(pending)
		pending = pending[:0]
		m.emit(terminalOutputEvent, TerminalOutput{ID: s.id, Data: data})
	}
	for {
		select {
		case chunk, ok := <-chunks:
			if !ok {
				flush()
				m.finish(s)
				return
			}
			pending = append(pending, chunk...)
			if len(pending) >= terminalBatchBytes {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (m *terminalManager) finish(s *terminalSession) {
	s.cancelKill()
	code := 0
	if err := s.cmd.Wait(); err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			code = exitErr.ExitCode()
		} else {
			code = -1
		}
	}
	m.mu.Lock()
	delete(m.sessions, s.id)
	m.mu.Unlock()
	m.emit(terminalExitEvent, TerminalExit{ID: s.id, Code: code})
}

func dimension(value int, fallback uint16) uint16 {
	if value <= 0 {
		return fallback
	}
	if value > 1000 {
		return 1000
	}
	return uint16(value)
}
