# LumenCortex Desktop — Interaction Specification

## 1. New Task interaction

### Default state
- Project selected.
- Composer focused.
- Effective default model selected.
- Workspace permission profile selected.
- Local run environment selected.

### Submit
- Enter submits.
- Shift+Enter inserts newline.
- Disabled if task is empty.
- On submit:
  1. create durable session,
  2. immediately start agent,
  3. show thread,
  4. mark sidebar row running.

### Failure
- Session creation failure: remain in composer, preserve draft.
- Agent start failure after session creation: keep created thread and show actionable error.
- Missing model: show direct link to Models & Providers.

## 2. Model picker

Display:
- Provider display name,
- Model display name,
- optional context/output metadata.

Persist/run with:
- `provider/model`.

Do not expose:
- resolved API key,
- raw Authorization header.

## 3. Provider management

### Scope control
Segment:
- Global
- Current Project

Project scope disabled when no project is open.

### Provider row
Collapsed row shows:
- name,
- provider ID,
- base URL/protocol,
- model count.

Actions:
- expand,
- edit,
- delete.

### Model row
Shows:
- model display name,
- upstream modelID,
- limits,
- local default,
- effective default.

Actions:
- set default,
- edit,
- delete.

### Advanced JSON
Collapsed by default.
Use only for:
- bulk edits,
- unsupported advanced fields.

Saving malformed JSON:
- do not overwrite existing config,
- show parse error,
- preserve editor text.

## 4. Running thread

Main thread should show:
- task intro,
- assistant/user messages,
- compact tool steps,
- milestone/progress blocks,
- final result,
- follow-up composer.

Raw events live in Activity inspector.

### Tool cards
Collapsed by default unless:
- error,
- approval needed,
- user explicitly opens.

Summary should include:
- tool name,
- target file/command,
- duration/status,
- concise result.

## 5. Approval interaction

When backend enters `waiting_gate`:
- thread gets attention indicator,
- inline approval card appears,
- sidebar marks thread,
- run controls change.

Approval card must show:
- requested operation,
- scope,
- risk/permission meaning,
- Approve,
- Deny.

Do not hide approval only in Activity.

## 6. Stop / Resume

### Stop
- available while running,
- calls real cancellation,
- optimistic visual may show "Stopping…" only if backend can confirm cancellation path.

### Resume
- shown for interrupted sessions,
- resumes from durable thread state where runtime semantics support it.

## 7. Review interaction

### Entry
Review becomes available when changed-file metadata exists.

### File list
- status badge,
- filename/path,
- additions/deletions.

### Diff
Modes:
- Unified
- Split

Actions:
- inline comment,
- revert file,
- stage/unstage.

### Inline feedback
Comment can be converted into a follow-up instruction for the agent.

## 8. Sidebar interaction

Thread groups:
- Running
- Needs attention
- Recent
- Completed

Thread row:
- task title,
- status,
- relative/latest time.

Keyboard target:
- Cmd/Ctrl+N new task,
- Cmd/Ctrl+K search/switch,
- Cmd/Ctrl+Shift+P provider/settings optional future shortcut.

## 9. Inspector behavior

Inspector is not open by default on initial empty state.

Provider settings may use a wider panel.

At <=1180:
- inspector becomes overlay drawer.

At <=820:
- sidebar also becomes overlay drawer.

Escape should close the active drawer/dialog where safe.

## 10. Error model

Errors must be classified:
- user/config,
- provider/network,
- runtime,
- permission,
- cancellation,
- internal.

UI should show:
- concise summary,
- technical detail when useful,
- recovery action when available.

Never surface secrets in error text.

## 11. Long-task behavior

- Live event list capped.
- Terminal tail capped.
- Message history paged/capped.
- Large tool output truncated.
- Manual scrolling should not be yanked to bottom.
- "Jump to latest" appears when user is reviewing older content.

## 12. Empty states

### No project
Primary action: Open project.

### No models
Primary action: Configure model/provider.

### No threads
Primary action: New task.

### No review changes
Explain that no file changes were detected; do not show empty diff chrome.

### No activity
Show quiet placeholder, not a large illustration.
