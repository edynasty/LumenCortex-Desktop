package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// This file is the Desktop adapter over Core's OMP session import (ADR-0011). Core owns everything
// that matters: it lists OMP's session files, resolves the active branch, converts the visible
// history, derives the native session ids, writes the whole tree in one transaction and records
// the provenance. Desktop only forwards the three calls, always against OMP's default directory
// (Root ""): the UI never chooses a source directory. A preview writes nothing, and an import of a
// session imported before returns AlreadyImported without writing.

// OMPSessionSummary is one top-level OMP session as the import dialog lists it.
type OMPSessionSummary = lcx.OMPSessionSummary

// OMPImportPreview is what importing one session would write.
type OMPImportPreview = lcx.OMPImportPreview

// OMPImportResult reports an import; AlreadyImported means nothing was written.
type OMPImportResult = lcx.OMPImportResult

// OMPImportStats counts what a conversion copied, changed and left out.
type OMPImportStats = lcx.OMPImportStats

// OMPWarning is one preview finding: a stable code and Core's English explanation.
type OMPWarning = lcx.OMPWarning

// OMPImportRef is the native session an OMP session was imported into.
type OMPImportRef = lcx.OMPImportRef

// OMPChildPreview is one subagent session imported with its parent.
type OMPChildPreview = lcx.OMPChildPreview

// OMPListOptions selects the sessions to list. Root "" is OMP's sessions directory; All lists every
// workspace instead of this one; Query filters by title, id or directory; Limit defaults to 100.
type OMPListOptions = lcx.OMPListOptions

// ListOMPSessions lists OMP sessions for the import dialog. Without All it returns only sessions
// that ran in the open workspace or below it; a missing OMP directory is an empty list, not an error.
func (r *Runtime) ListOMPSessions(ctx context.Context, opts OMPListOptions) ([]OMPSessionSummary, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return nil, err
	}
	return engine.OMPSessions(ctx, opts)
}

// PreviewOMPSession reads one OMP session and reports what an import would write. It writes nothing.
func (r *Runtime) PreviewOMPSession(ctx context.Context, root, path string) (OMPImportPreview, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return OMPImportPreview{}, err
	}
	return engine.PreviewOMPSession(ctx, root, path)
}

// ImportOMPSession imports one OMP session and its subagent sessions into the open workspace.
func (r *Runtime) ImportOMPSession(ctx context.Context, root, path string) (OMPImportResult, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return OMPImportResult{}, err
	}
	return engine.ImportOMPSession(ctx, root, path)
}
