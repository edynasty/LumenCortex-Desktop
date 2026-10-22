package backend

import (
	"bytes"
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

// The OMP fixture copied from Core (internal/ompsession/testdata): a real-format 18.12 session with
// an abandoned branch, thinking blocks, a compaction, an unanswered call, a subagent tree and a
// killed subagent. Its content is kept as is; a test only rewrites the header's cwd, so the session
// belongs to the temporary workspace the test opens.
const (
	ompFixtureRoot    = "testdata/omp/sessions"
	ompFixtureID      = "01a10000-0000-7000-8000-000000000001"
	ompFixtureProject = "-fixture-workspace"
	ompFixtureName    = "2026-10-01T08-00-00-000Z_" + ompFixtureID + ".jsonl"
	ompOtherID        = "01a10000-0000-7000-8000-000000000002"
	ompOtherName      = "2026-10-02T08-00-00-000Z_" + ompOtherID + ".jsonl"
)

// useOMPFixture copies the fixture into a private agent directory, points PI_CODING_AGENT_DIR at it
// and returns the agent directory. The session's cwd is set to workspace, and a second session of
// another directory is added, so the workspace filter has something to exclude.
func useOMPFixture(t *testing.T, workspace string) string {
	t.Helper()
	agentDir := filepath.Join(t.TempDir(), "agent")
	sessions := filepath.Join(agentDir, "sessions")
	if err := copyTree(ompFixtureRoot, sessions); err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(sessions, ompFixtureProject, ompFixtureName)
	body, err := os.ReadFile(source)
	if err != nil {
		t.Fatal(err)
	}
	mine, err := withRecordField(body, "session", "cwd", workspace)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, mine, 0o600); err != nil {
		t.Fatal(err)
	}

	otherDir := filepath.Join(sessions, "-other-workspace")
	if err := os.MkdirAll(otherDir, 0o700); err != nil {
		t.Fatal(err)
	}
	other, err := withRecordField(body, "session", "id", ompOtherID)
	if err != nil {
		t.Fatal(err)
	}
	if other, err = withRecordField(other, "title", "title", "Retire the old indexer"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(otherDir, ompOtherName), other, 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("PI_CODING_AGENT_DIR", agentDir)
	return agentDir
}

// withRecordField rewrites one field of the first record of the given type, leaving every other byte.
func withRecordField(body []byte, recordType, field, value string) ([]byte, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	lines := bytes.SplitAfter(body, []byte("\n"))
	for i, line := range lines {
		var probe struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(bytes.TrimSpace(line), &probe) != nil || probe.Type != recordType {
			continue
		}
		var record map[string]json.RawMessage
		if err := json.Unmarshal(bytes.TrimSpace(line), &record); err != nil {
			return nil, err
		}
		record[field] = encoded
		replaced, err := json.Marshal(record)
		if err != nil {
			return nil, err
		}
		trailing := []byte("\n")
		if !bytes.HasSuffix(line, trailing) {
			trailing = nil
		}
		lines[i] = append(replaced, trailing...)
		return bytes.Join(lines, nil), nil
	}
	return nil, os.ErrInvalid
}

func copyTree(from, to string) error {
	return filepath.WalkDir(from, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(from, path)
		if err != nil {
			return err
		}
		target := filepath.Join(to, rel)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, body, 0o600)
	})
}

func openOMPRuntime(t *testing.T, workspace string) *Runtime {
	t.Helper()
	useConfigDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	if _, err := r.OpenWorkspace(context.Background(), workspace); err != nil {
		t.Fatal(err)
	}
	return r
}

// The dialog's default list is this workspace's sessions; the toggle widens it to every workspace.
func TestListOMPSessionsFiltersByWorkspace(t *testing.T) {
	workspace := t.TempDir()
	useOMPFixture(t, workspace)
	r := openOMPRuntime(t, workspace)
	ctx := context.Background()

	mine, err := r.ListOMPSessions(ctx, OMPListOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(mine) != 1 {
		t.Fatalf("workspace list = %+v", mine)
	}
	session := mine[0]
	if session.ID != ompFixtureID || session.Title != "Fix the parser bug" || !session.WorkspaceMatch {
		t.Fatalf("summary %+v", session)
	}
	if session.Cwd != workspace || session.Size <= 0 || session.Children != 2 || session.Imported != nil {
		t.Fatalf("summary %+v", session)
	}

	all, err := r.ListOMPSessions(ctx, OMPListOptions{All: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Fatalf("all = %+v", all)
	}
	if all[0].ID != ompOtherID || all[1].ID != ompFixtureID {
		t.Fatalf("all is newest first: %+v", all)
	}

	query, err := r.ListOMPSessions(ctx, OMPListOptions{All: true, Query: "parser"})
	if err != nil {
		t.Fatal(err)
	}
	if len(query) != 1 || query[0].ID != ompFixtureID {
		t.Fatalf("query = %+v", query)
	}
	other, err := r.ListOMPSessions(ctx, OMPListOptions{All: true, Query: "indexer"})
	if err != nil {
		t.Fatal(err)
	}
	if len(other) != 1 || other[0].ID != ompOtherID {
		t.Fatalf("query = %+v", other)
	}

	limited, err := r.ListOMPSessions(ctx, OMPListOptions{All: true, Limit: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(limited) != 1 {
		t.Fatalf("limit = %+v", limited)
	}
}

// Preview reads the source and the workspace, and writes neither.
func TestPreviewOMPSessionWritesNothing(t *testing.T) {
	workspace := t.TempDir()
	agentDir := useOMPFixture(t, workspace)
	r := openOMPRuntime(t, workspace)
	ctx := context.Background()
	path := filepath.Join(agentDir, "sessions", ompFixtureProject, ompFixtureName)
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	preview, err := r.PreviewOMPSession(ctx, "", path)
	if err != nil {
		t.Fatal(err)
	}
	if preview.SessionID == "" || preview.Goal != "Fix the parser bug" || preview.Source.ID != ompFixtureID {
		t.Fatalf("preview %+v", preview)
	}
	if len(preview.Children) != 3 || preview.OffBranch != 1 || preview.Stats.ThinkingBlocks == 0 {
		t.Fatalf("preview %+v", preview)
	}
	if preview.Source.Imported != nil || preview.Stats.Images == 0 || preview.Stats.Compactions == 0 {
		t.Fatalf("preview %+v", preview)
	}

	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before, after) {
		t.Fatal("preview changed the source file")
	}
	if sessions, err := r.ListSessions(ctx, 100, 0); err != nil || len(sessions) != 0 {
		t.Fatalf("preview wrote sessions: %d, %v", len(sessions), err)
	}
}

// Import writes the tree once; importing the same source again reports it and writes nothing.
func TestImportOMPSessionIsIdempotent(t *testing.T) {
	workspace := t.TempDir()
	agentDir := useOMPFixture(t, workspace)
	r := openOMPRuntime(t, workspace)
	ctx := context.Background()
	path := filepath.Join(agentDir, "sessions", ompFixtureProject, ompFixtureName)

	first, err := r.ImportOMPSession(ctx, "", path)
	if err != nil {
		t.Fatal(err)
	}
	if first.AlreadyImported || first.SourceChanged || first.Sessions != 4 || first.SessionID == "" {
		t.Fatalf("first import %+v", first)
	}
	session, err := r.GetSession(ctx, first.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	if session.Status != "completed" || session.Goal != "Fix the parser bug" {
		t.Fatalf("session %+v", session)
	}

	listed, err := r.ListOMPSessions(ctx, OMPListOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 || listed[0].Imported == nil || listed[0].Imported.SessionID != first.SessionID || listed[0].Imported.SourceChanged {
		t.Fatalf("listed after import %+v", listed)
	}

	second, err := r.ImportOMPSession(ctx, "", path)
	if err != nil {
		t.Fatal(err)
	}
	if !second.AlreadyImported || second.SourceChanged || second.Sessions != 0 || second.SessionID != first.SessionID {
		t.Fatalf("second import %+v", second)
	}
	if sessions, err := r.ListSessions(ctx, 100, 0); err != nil || len(sessions) != 4 {
		t.Fatalf("sessions after two imports: %d, %v", len(sessions), err)
	}
}

// No OMP directory (a fresh machine) is an empty list, not a failure.
func TestListOMPSessionsWithoutOMPDirectory(t *testing.T) {
	workspace := t.TempDir()
	t.Setenv("PI_CODING_AGENT_DIR", filepath.Join(t.TempDir(), "missing"))
	r := openOMPRuntime(t, workspace)

	sessions, err := r.ListOMPSessions(context.Background(), OMPListOptions{All: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 0 {
		t.Fatalf("sessions %+v", sessions)
	}
}

// The adapter needs an open workspace: the import writes into it.
func TestOMPSessionsRequireWorkspace(t *testing.T) {
	useConfigDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	if _, err := r.ListOMPSessions(context.Background(), OMPListOptions{}); err != ErrNoWorkspace {
		t.Fatalf("list error = %v", err)
	}
	if _, err := r.PreviewOMPSession(context.Background(), "", "x.jsonl"); err != ErrNoWorkspace {
		t.Fatalf("preview error = %v", err)
	}
	if _, err := r.ImportOMPSession(context.Background(), "", "x.jsonl"); err != ErrNoWorkspace {
		t.Fatalf("import error = %v", err)
	}
}
