# Owner feedback round, 2026-10-23

Scope: the six screenshot notes the owner sent after the plugins-rail build (`a890253`). Baseline
Desktop `a890253`, Core `b438b22` (v0.1.3). Status: implemented and validated, except where noted
under Limits.

| # | Owner note | Change | Commit |
|---|---|---|---|
| 1 | A Skills item could not be clicked to see its details | A shadowed duplicate or a broken link now opens its own details: source, scope, path or link target, and why it is excluded. It never loads the winning skill's body. | Desktop `0f2d32a` |
| 2 | The Dock icon was not the icon shown in About | Iconset members from 64 px up now render from the glass master. The Dock uses those sizes. The flat small master is kept only for 16–32 px. | Desktop `47f347c` |
| 3 | The plugin page looked bad | New layout: a hero (glyph, name, state badge, description, enable switch), an entries card (the primary action as a described tile, then the rail toggle), a details card (definition grid, capability chips) and a link to the Settings diagnostics. | Desktop `75022e3` |
| 4 | A recent project that no longer exists should be greyed, with an × to remove it, as in IntelliJ | `App.MissingDirectories` checks the stored paths, at most 32 per call. A missing entry stays listed, greyed and inert. Any entry except the open project has an × (and Delete in the menu) that removes it from Desktop's list. The folder itself is never touched. Applies to the project menu and the welcome screen. It rechecks when the list changes and on window focus. | Desktop `5eed9ab` |
| 5 | The right panel should show the directory and a terminal | Core `ListDir`/`SessionListDir` (one level, dirs first, `.git` skipped, capped at 2000 with `truncated`, confined to the workspace including through symlinks). Desktop adds Files and Terminal inspector tabs. Files is a lazy tree with copy path and a confined Reveal in Finder. Terminal is a real login shell (`creack/pty`, xterm.js in a lazy chunk, base64 batched output events, at most 8 shells, all closed on a workspace change and on shutdown). The terminal stays mounted across tab switches. | Core `f8d6459`, `42ee234` (tag `v0.1.4`, local); Desktop `6e8bce6` |
| 6 | The version does not need to be on the home screen | The rail version button is removed. The version stays in Settings → About and in the app menu's About. | Desktop `b56f4b7` |

## Core pin

Desktop `go.mod` pins `github.com/edynasty/LumenCortex v0.1.4`. That tag is local and unpushed. It
was resolved with `lcx_use_unpublished_core` (GOPRIVATE plus a download-only `url.insteadOf`), and
the module cache origin is the tag commit `42ee234`. The tag must be pushed before a clean machine
can build Desktop.

## Checks run

- Core `go test ./...`: pass (run by the implementing agent at `42ee234`).
- Desktop `go test -mod=readonly ./...`: pass, including `TestMissingDirectoriesReportsGoneAndNonDirectoryPaths`, `terminal_test.go` (start/write/read/resize/close against a real shell, cwd, bound, CloseAll), `files_test.go` and `app_inspector_test.go` (cwd and reveal confinement).
- Frontend `npx tsc --noEmit`: pass. `npx vitest run`: 76 files, 411 tests pass. New or changed tests: ProjectMenu (missing row inert; × and Delete remove, but not the open project; focus position kept), useWorkspaceController (missing set; remove edits only the list), SkillsPanel (blocked rows open details), FilesPanel (7 tests), Rail (version test removed with the feature).
- `scripts/build-macos.sh` with the v0.1.4 pin: bundle verified (`core: v0.1.4 (runtime 0.1.4-preview)`, self-check ok). The app launched and its AX tree shows the rail without a version.
- Visual harness (Playwright Chromium, throwaway script, deleted): the plugin page in dark and light, the project menu with a greyed `old-prototype` entry and × actions, the Files tab with an expanded tree, and the Terminal tab mounted. Screenshots reviewed.

## Limits

- Native interaction with the terminal and file tree was not driven. A full AX walk of the window takes more than 180 s and timed out, and Screen Recording is denied, so `screencapture` fails. The PTY path is covered by the Go tests above. Typing into the native terminal is an owner check.
- The welcome screen's × and greyed rows were not seen visually: the harness reopens the last project, so it never shows the welcome screen. The welcome rows share the hook and stub that the menu screenshot exercises.
- Intermediate commits were not built one by one. The final tree passes all of the checks above.
