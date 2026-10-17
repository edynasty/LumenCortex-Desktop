package backend

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"sync/atomic"
	"testing"

	"github.com/edynasty/LumenCortex/protocol"
)

// C1 (ADR-0006 D3) from Desktop: a thread whose agent opens a work unit and then answers ends its turn
// completed with the answer. The unit and the open resolution stay for the next turn, no correction is
// appended and, as nothing in the workspace changed, no check runs.
func TestConversationTurnEndsWithAnOpenWorkUnit(t *testing.T) {
	workspace := setupGitWorkspace(t)
	var requests atomic.Int32
	r := openChecksWorkspace(t, workspace, func(w http.ResponseWriter, _ *http.Request) {
		if requests.Add(1) == 1 {
			replyToolCall(w, "u1", "work_unit_create", `{"id":"fix","goal":"fix the rollback"}`)
			return
		}
		replyText(w, "Plan: add the rollback in commit().")
	})
	ctx := context.Background()
	session, err := r.CreateSession(ctx, "discuss the transaction bug")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only", MaxSteps: 4}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)

	got, err := r.GetSession(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != "completed" || got.Final == nil || *got.Final != "Plan: add the rollback in commit()." || requests.Load() != 2 {
		t.Fatalf("session %s final %v after %d requests", got.Status, got.Final, requests.Load())
	}
	ts, err := r.TaskState(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if open := ts.State.Units().Incomplete(); len(open) != 1 || open[0].ID != "fix" {
		t.Fatalf("open units %+v", open)
	}
	if ts.State.Resolution.State != "open" || !slices.Contains(ts.Obligations, "work_units") {
		t.Fatalf("resolution %+v obligations %v", ts.State.Resolution, ts.Obligations)
	}
	if results, err := r.CheckResults(ctx, session.ID, -1, 0); err != nil || len(results) != 0 {
		t.Fatalf("a turn that changed nothing ran checks: %+v err=%v", results, err)
	}
	page, err := r.MessagePage(ctx, session.ID, -1, 200)
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range page.Messages {
		var row protocol.Message
		if err := json.Unmarshal(m.JSON, &row); err != nil {
			t.Fatal(err)
		}
		if row.Origin == protocol.OriginCompletionBlocked {
			t.Fatalf("correction row in a conversation turn: %s", row.Content)
		}
	}
}
