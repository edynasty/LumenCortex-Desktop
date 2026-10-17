package backend

import (
	"context"
	"strings"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// ChecksInfo is Core's view of the session's configured checks against its workspace's current
// state: whether each is satisfied at the current fingerprint, the result that satisfies it, the
// newest result, and warnings for checks the configuration dropped (an untrusted workspace's).
type ChecksInfo = lcx.ChecksInfo

// CheckResult is one stored check result: provenance "runtime" or "human:<id>".
type CheckResult = lcx.CheckResult

// CheckArtifact is a check's log or the diff a non-passing result covers, as text. Invalid UTF-8 (a
// binary diff) is replaced, so the UI never receives bytes it cannot show.
type CheckArtifact struct {
	Hash      string `json:"hash"`
	Kind      string `json:"kind"`
	Size      int64  `json:"size"`
	Truncated bool   `json:"truncated"`
	Text      string `json:"text"`
}

// SessionChecks reads the session's checks. It runs nothing and takes no lock.
func (r *Runtime) SessionChecks(ctx context.Context, sessionID string) (ChecksInfo, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return ChecksInfo{}, err
	}
	return engine.SessionChecks(ctx, sessionID)
}

// CheckResults pages the session's results newest first; beforeSeq -1 is the newest page.
func (r *Runtime) CheckResults(ctx context.Context, sessionID string, beforeSeq int64, limit int) ([]CheckResult, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return nil, err
	}
	return engine.CheckResults(ctx, sessionID, beforeSeq, limit)
}

// CheckArtifact reads one artifact of the session.
func (r *Runtime) CheckArtifact(ctx context.Context, sessionID, hash string) (CheckArtifact, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return CheckArtifact{}, err
	}
	a, err := engine.CheckArtifact(ctx, sessionID, hash)
	if err != nil {
		return CheckArtifact{}, err
	}
	return CheckArtifact{Hash: a.Hash, Kind: a.Kind, Size: a.Size, Truncated: a.Truncated, Text: strings.ToValidUTF8(string(a.Data), "\uFFFD")}, nil
}

// AcceptCheck records the user's acceptance of a check at the workspace's current fingerprint. It
// holds until the workspace changes. Outside git Core refuses it (ErrNoFingerprint).
func (r *Runtime) AcceptCheck(ctx context.Context, sessionID, checkID, actor string) (CheckResult, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return CheckResult{}, err
	}
	return engine.AcceptCheck(ctx, sessionID, checkID, actor)
}
