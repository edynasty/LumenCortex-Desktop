package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// This file is the Desktop adapter over Core's plugin platform and session import (ADR-0012). Core
// owns everything that matters: plugins declare import sources, read another runtime's session
// files, convert their visible history, derive the native session ids, write the whole tree in one
// transaction and record the provenance. Desktop only forwards the calls, always against the
// source's default directory (Root ""): the UI never chooses a source directory. A preview writes
// nothing, and an import of a session imported before returns AlreadyImported without writing.

// ImportSource is one running session import source.
type ImportSource = lcx.ImportSource

// ImportSessionSummary is one top-level session of a source as the import dialog lists it.
type ImportSessionSummary = lcx.ImportSessionSummary

// ImportPreview is what importing one session would write.
type ImportPreview = lcx.ImportPreview

// ImportResult reports an import; AlreadyImported means nothing was written.
type ImportResult = lcx.ImportResult

// ImportStats counts what a conversion copied, changed and left out.
type ImportStats = lcx.ImportStats

// ImportWarning is one preview finding: a stable code and Core's English explanation.
type ImportWarning = lcx.ImportWarning

// ImportRef is the native session a source session was imported into.
type ImportRef = lcx.ImportRef

// ImportChildPreview is one subagent session imported with its parent.
type ImportChildPreview = lcx.ImportChildPreview

// ImportListOptions selects the sessions to list. Root "" is the source's default directory; All
// lists every workspace instead of this one; Query filters by title, id or directory; Limit
// defaults to 100.
type ImportListOptions = lcx.ImportListOptions

// PluginCatalog is every registered plugin with its enablement, state and failures.
type PluginCatalog = lcx.PluginCatalog

// PluginInfo is one plugin as the Settings pane shows it.
type PluginInfo = lcx.PluginInfo

// ImportSources lists the session import sources whose plugin is running. A disabled or failed
// plugin has no source, so it does not appear here.
func (r *Runtime) ImportSources(ctx context.Context) ([]ImportSource, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return nil, err
	}
	return engine.ImportSources(), nil
}

// ListImportSessions lists a source's sessions for the import dialog. Without All it returns only
// sessions that ran in the open workspace or below it; a missing source directory is an empty list,
// not an error.
func (r *Runtime) ListImportSessions(ctx context.Context, source string, opts ImportListOptions) ([]ImportSessionSummary, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return nil, err
	}
	return engine.ListImportSessions(ctx, source, opts)
}

// PreviewImport reads one session of a source and reports what an import would write. It writes
// nothing.
func (r *Runtime) PreviewImport(ctx context.Context, source, root, path string) (ImportPreview, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return ImportPreview{}, err
	}
	return engine.PreviewImport(ctx, source, root, path)
}

// ImportSession imports one session of a source and its subagent sessions into the open workspace.
func (r *Runtime) ImportSession(ctx context.Context, source, root, path string) (ImportResult, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return ImportResult{}, err
	}
	return engine.ImportSession(ctx, source, root, path)
}

// Plugins lists the registered plugins of the open workspace's Engine with their enablement, state
// and failures. Enablement is global: a change applies to every workspace at its next open.
func (r *Runtime) Plugins(ctx context.Context) (PluginCatalog, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return PluginCatalog{}, err
	}
	return engine.Plugins(), nil
}

// SetPluginEnabled records a plugin's enablement and applies it to the open Engine now.
func (r *Runtime) SetPluginEnabled(ctx context.Context, id string, enabled bool) error {
	engine, err := r.currentEngine()
	if err != nil {
		return err
	}
	return engine.SetPluginEnabled(ctx, id, enabled)
}
