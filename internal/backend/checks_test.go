package backend

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// openChecksWorkspace serves "done" to every request, configures the global check "status" (passes only
// when ok.txt exists) and opens workspace.
func openChecksWorkspace(t *testing.T, workspace string) *Runtime {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { replyText(w, "done") }))
	t.Cleanup(server.Close)
	writeFile(t, useConfigDir(t), fmt.Sprintf(`{
  "model": "test/a",
  "checks": {"status": {"kind": "test", "command": "echo checking status; test -f ok.txt"}},
  "providers": {"test": {"settings": {"baseURL": %q}, "models": {"a": {"modelID": "upstream-a", "limit": {"context": 65536, "output": 8192}}}}}
}`, server.URL+"/v1"))
	r := New()
	t.Cleanup(func() { r.Close() })
	if _, err := r.OpenWorkspace(context.Background(), workspace); err != nil {
		t.Fatal(err)
	}
	return r
}

func statusCheck(t *testing.T, r *Runtime, sessionID string) lcx.CheckInfo {
	t.Helper()
	info, err := r.SessionChecks(context.Background(), sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if len(info.Checks) != 1 || info.Checks[0].Spec.ID != "status" {
		t.Fatalf("checks=%+v", info.Checks)
	}
	return info.Checks[0]
}

// M4.2 acceptance (design §8.2): "accept" records a human:<id> result for the current fingerprint. The
// completion gate then takes it without running the check, and it stops counting once the workspace
// changes.
func TestAcceptRecordsAHumanResultAtTheCurrentFingerprint(t *testing.T) {
	workspace := setupGitWorkspace(t)
	r := openChecksWorkspace(t, workspace)
	ctx := context.Background()
	session, err := r.CreateSession(ctx, "accept the status check")
	if err != nil {
		t.Fatal(err)
	}
	if c := statusCheck(t, r, session.ID); c.Satisfied || c.Deciding != nil {
		t.Fatalf("before accepting: %+v", c)
	}

	accepted, err := r.AcceptCheck(ctx, session.ID, "status", "desktop-user")
	if err != nil {
		t.Fatal(err)
	}
	if accepted.Provenance != "human:desktop-user" || accepted.Status != "passed" || accepted.Check != "status" {
		t.Fatalf("acceptance=%+v", accepted)
	}
	c := statusCheck(t, r, session.ID)
	if !c.Satisfied || c.Deciding == nil || c.Deciding.Seq != accepted.Seq || c.Deciding.Fingerprint != accepted.Fingerprint {
		t.Fatalf("the acceptance is not the current fingerprint's deciding result: %+v", c)
	}

	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)
	results, err := r.CheckResults(ctx, session.ID, -1, 0)
	if err != nil || len(results) != 1 {
		t.Fatalf("the gate ran the accepted check: results=%+v err=%v", results, err)
	}
	ts, err := r.TaskState(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ts.State.Resolution.State != "done" || ts.State.Resolution.By != "evidence" {
		t.Fatalf("resolution=%+v", ts.State.Resolution)
	}

	if err := os.WriteFile(filepath.Join(workspace, "README.md"), []byte("changed\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if c := statusCheck(t, r, session.ID); c.Satisfied || c.Newest == nil || c.Newest.Seq != accepted.Seq {
		t.Fatalf("the acceptance outlived a workspace change: %+v", c)
	}
}

// A failing required check leaves results and artifacts the UI pages through and reads as text.
func TestCheckResultsPageAndArtifactsReadAsText(t *testing.T) {
	workspace := setupGitWorkspace(t)
	r := openChecksWorkspace(t, workspace)
	ctx := context.Background()
	session, err := r.CreateSession(ctx, "fail the status check")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workspace, "README.md"), []byte("edited by the run\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)
	all, err := r.CheckResults(ctx, session.ID, -1, 0)
	if err != nil || len(all) != 2 {
		t.Fatalf("results=%+v err=%v (the gate decides the check at each of the 2 final answers)", all, err)
	}
	first, err := r.CheckResults(ctx, session.ID, -1, 1)
	if err != nil || len(first) != 1 || first[0].Seq != all[0].Seq {
		t.Fatalf("first page=%+v err=%v", first, err)
	}
	second, err := r.CheckResults(ctx, session.ID, first[0].Seq, 1)
	if err != nil || len(second) != 1 || second[0].Seq != all[1].Seq {
		t.Fatalf("second page=%+v err=%v", second, err)
	}

	failed := all[0]
	if failed.Status != "failed" || failed.Provenance != "runtime" || len(failed.Artifacts) != 2 {
		t.Fatalf("result=%+v", failed)
	}
	texts := map[string]string{}
	for _, hash := range failed.Artifacts {
		a, err := r.CheckArtifact(ctx, session.ID, hash)
		if err != nil {
			t.Fatal(err)
		}
		if a.Hash != hash || a.Size == 0 {
			t.Fatalf("artifact=%+v", a)
		}
		texts[a.Kind] = a.Text
	}
	if !strings.Contains(texts["log"], "checking status") || !strings.Contains(texts["diff"], "edited by the run") {
		t.Fatalf("artifact texts=%q", texts)
	}
	if _, err := r.CheckArtifact(ctx, session.ID, "sha256:"+strings.Repeat("0", 64)); !errors.Is(err, lcx.ErrArtifactNotFound) {
		t.Fatalf("missing artifact: %v", err)
	}
}

// Outside git there is no fingerprint to accept: Core refuses, and the refusal carries the sentinel the
// frontend recognises. An unknown check is refused the same way.
func TestAcceptOutsideGitIsRefused(t *testing.T) {
	r := openChecksWorkspace(t, t.TempDir())
	ctx := context.Background()
	session, err := r.CreateSession(ctx, "no git")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.AcceptCheck(ctx, session.ID, "status", "desktop-user"); !errors.Is(err, lcx.ErrNoFingerprint) {
		t.Fatalf("accept outside git: %v", err)
	}
	if _, err := r.AcceptCheck(ctx, session.ID, "nope", "desktop-user"); !errors.Is(err, lcx.ErrUnknownCheck) {
		t.Fatalf("accept of an unknown check: %v", err)
	}
	if results, _ := r.CheckResults(ctx, session.ID, -1, 0); len(results) != 0 {
		t.Fatalf("a refused acceptance wrote %+v", results)
	}
}
