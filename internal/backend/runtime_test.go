package backend

import (
	"context"
	"testing"
)

func TestWorkspaceUsesEmbeddedLumenCortexRuntime(t *testing.T) {
	ctx := context.Background()
	r := New()
	defer r.Close()

	state, err := r.OpenWorkspace(ctx, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if state.Health == nil || state.Workspace == "" {
		t.Fatalf("unexpected state: %#v", state)
	}
	session, err := r.CreateSession(ctx, "desktop smoke")
	if err != nil {
		t.Fatal(err)
	}
	if session.ID == "" {
		t.Fatal("session id is empty")
	}
	messages, err := r.RecentMessages(ctx, session.ID, 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 0 {
		t.Fatalf("new session has %d messages", len(messages))
	}
}
