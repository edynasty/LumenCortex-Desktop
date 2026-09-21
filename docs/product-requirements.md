# LumenCortex Desktop — Product Requirements

## 1. Product vision

LumenCortex Desktop is a local-first coding-agent command center for developers who want to run, supervise, and review coding agents against real repositories without giving up control of model choice, permissions, runtime boundaries, or local state.

The product is not a generic chat client and not an observability dashboard. Its primary unit of work is a **coding task** bound to a **project**, represented as a durable **thread**, executed by an **agent run**, and completed through **review**.

## 2. Product principles

1. **Task first**
   - The user should be able to start a coding task quickly.
   - The composer is the primary control surface.
   - Runtime detail is secondary.

2. **Local-first**
   - Projects are local repositories/workspaces.
   - Session history and execution metadata are durable locally.
   - Secrets are referenced, not exposed.

3. **Inspectability**
   - Users must always be able to answer:
     - What is the agent doing?
     - What changed?
     - What is blocked?
     - What needs my approval?
     - Can I stop or redirect it?

4. **Parallel but safe**
   - Multiple threads may run in parallel.
   - Worktree support is the preferred future isolation model.
   - Concurrency must remain bounded.

5. **Configuration without friction**
   - Common settings are graphical.
   - Raw JSON/config is an advanced escape hatch.
   - Provider/model selection is visible near task submission.

6. **Desktop-native**
   - Compact controls.
   - Stable spatial layout.
   - Strong keyboard affordances.
   - No dashboard-style metric wall.

## 3. Primary users

### 3.1 Individual developer
Needs:
- run tasks against a local repo,
- choose models/providers,
- inspect tool execution,
- review changes,
- keep session history.

### 3.2 Power user / agent operator
Needs:
- multiple providers/models,
- parallel threads,
- permission control,
- worktrees,
- MCP/Skills/Plugins,
- deeper runtime observability.

### 3.3 Team lead / reviewer
Needs:
- understand agent output,
- review diffs,
- inspect tests,
- leave corrective feedback,
- commit/push after review.

## 4. Primary jobs to be done

### JTBD-01 Start a coding task
When I know what I want changed, I want to select a project, model, permission profile, and run environment, so I can start the task in one place.

### JTBD-02 Supervise execution
When an agent is running, I want to understand progress and blockers without reading raw logs.

### JTBD-03 Review changes
When an agent finishes, I want to inspect changed files, tests, and diffs, then accept, comment, revert, commit, or continue the task.

### JTBD-04 Run parallel work
When I have independent tasks, I want to run them safely in parallel and understand which workspace/worktree each task owns.

### JTBD-05 Configure the harness
When I need a different model or extension, I want to configure providers, MCP, skills, plugins, and future LSP graphically.

## 5. Core product objects

### Project
- local workspace/repository,
- recent project metadata,
- project-scoped configuration,
- project threads.

### Thread
- task goal,
- durable messages,
- run status,
- provider/model identity,
- usage,
- tool activity,
- final result,
- review state.

### Run Environment
- model,
- provider,
- permission profile,
- Local/Worktree,
- branch/base,
- process/tool state.

### Review
- changed files,
- diff,
- test/check summary,
- inline comments,
- stage/revert/commit/push.

### Extension
- provider/model,
- skill,
- MCP server/tool,
- plugin/tool,
- future LSP service.

## 6. Core user journeys

### Journey A — Start
1. Open/select project.
2. Enter task.
3. Select model.
4. Select permission profile.
5. Select Local/Worktree when supported.
6. Run.
7. Thread appears in sidebar and becomes active.

Target: under 10 seconds from project selection to running task.

### Journey B — Supervise
1. Open running thread.
2. See task summary and running status.
3. See meaningful milestones.
4. Expand tool details when needed.
5. Approve/deny gates inline.
6. Stop/resume if necessary.

### Journey C — Review
1. Agent completes.
2. Review mode becomes available.
3. Changed files are listed.
4. User opens diff.
5. User leaves inline feedback or continues thread.
6. User stages/reverts/commits/pushes.

### Journey D — Parallel
1. Start task A.
2. Start task B in Local or Worktree.
3. Sidebar shows both running.
4. Attention state marks blocked/approval-required runs.
5. User switches without losing context.

### Journey E — Configure
1. Open Models & Providers.
2. Select Global or Project scope.
3. Add/edit provider.
4. Add/edit models.
5. Set default.
6. Composer immediately reflects effective model catalog.

## 7. Functional scope by milestone

### Milestone 1 — Foundation
- project selection,
- durable threads,
- task composer,
- model picker,
- Provider graphical management,
- activity inspector,
- basic terminal,
- run/cancel.

### Milestone 2 — Coding workspace
- repository search,
- Git status/diff,
- review mode,
- tool cards,
- approvals,
- Markdown/code rendering.

### Milestone 3 — Parallel execution
- multi-run supervisor,
- worktrees,
- bounded subagents,
- recovery of stale runs.

### Milestone 4 — Extensions
- MCP,
- Skills,
- Plugins,
- LSP,
- extension settings.

## 8. Non-goals for current phase

Not in current UI scope unless runtime support exists:
- fake Worktree selector,
- fake PR integration,
- fake MCP/Skill buttons,
- fake code indexing,
- fake collaboration presence.

The UI must not imply a capability that the runtime cannot perform.

## 9. Success metrics

### Activation
- time from app launch to first running task,
- percentage of users who configure at least one provider/model,
- percentage of projects with at least one completed thread.

### Task efficiency
- task start latency,
- number of clicks from project selection to run,
- rate of successful completed threads.

### Review
- percentage of completed threads opened in Review,
- percentage of tasks with diff inspected before commit,
- frequency of inline feedback/continuation.

### Reliability
- crash-free session rate,
- cancellation success,
- stale-run recovery success,
- frontend memory stability during long tasks.

## 10. Product acceptance gates

A feature is not done unless:
- it solves a real user journey,
- the primary action is obvious,
- advanced controls are progressive,
- source of truth is correct,
- no secret persistence is introduced,
- live state remains bounded,
- responsive behavior passes the documented breakpoints,
- frontend/backend/Wails checks pass when affected.
