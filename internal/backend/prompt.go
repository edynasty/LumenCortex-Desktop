package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// EffectivePrompt is Core's description of the prompt a run would send: its layers with their
// provenance and the tools its step could offer. Desktop displays it as it is; it never assembles
// a prompt of its own.
type EffectivePrompt = lcx.EffectivePromptResult

// PromptLayer is one piece of that prompt (a file, the skills block, the agent's instructions).
type PromptLayer = lcx.PromptLayer

// PromptTool is one tool the run's step could offer, with the filter that withholds it.
type PromptTool = lcx.PromptTool

// EffectivePromptRequest selects the run to describe. It carries the host's grant only: Core
// narrows it by the agent's ceilings, exactly as at a Start, so the page cannot show a prompt the
// run would not send.
type EffectivePromptRequest struct {
	// SessionID is the open session, "" for a first run in the workspace. With a session, the
	// prompt describes its pinned agent, Task State block and worktree.
	SessionID string `json:"sessionId,omitempty"`
	// Agent is the catalog agent to describe, "" for the default.
	Agent string `json:"agent,omitempty"`
	// Policy and Delegation are the host's grant; the agent's ceilings narrow them.
	Policy     string `json:"policy,omitempty"`
	Delegation string `json:"delegation,omitempty"`
	// Interactive marks a conversation turn, whose base prompt differs from a task run's.
	Interactive bool `json:"interactive,omitempty"`
}

// EffectivePrompt reads the prompt Core would assemble for req. It is a pure read: no run starts,
// no lock is taken and nothing is written. Without an open workspace there is no Engine, so there
// is no prompt to describe.
func (r *Runtime) EffectivePrompt(ctx context.Context, req EffectivePromptRequest) (EffectivePrompt, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return EffectivePrompt{}, ErrNoWorkspace
	}
	return engine.EffectivePrompt(ctx, lcx.EffectivePromptRequest{
		SessionID:   req.SessionID,
		Agent:       req.Agent,
		Policy:      req.Policy,
		Delegation:  req.Delegation,
		Interactive: req.Interactive,
	})
}
