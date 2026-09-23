import { useState } from "react";
import type { ThemePreference } from "../lib/theme";
import { WorkspaceExtensionsRoute } from "../app/WorkspaceExtensionsRoute";
import { WorkspaceReviewRoute } from "../app/WorkspaceReviewRoute";
import { WorkspaceOverlays } from "../app/WorkspaceOverlays";
import { AppShell } from "../components/app-shell/AppShell";
import { NewTaskComposer } from "../components/composer/NewTaskComposer";
import { ProviderSettingsPanel } from "../components/provider/ProviderSettingsPanel";
import { Sidebar } from "../components/sidebar/Sidebar";
import {
  groups,
  labels,
  localRuntime,
  providerCatalog,
  reviewMessages,
  session,
  sidebarLabels,
  workspace,
  type VisualScene,
} from "./fixture-data";
import { VisualInspectorFixture, VisualThreadScene, VisualTopbar } from "./VisualFixtureParts";

const noop = () => undefined;

function sceneFromLocation(): VisualScene {
  const value = new URLSearchParams(window.location.search).get("scene");
  return value === "thread" ||
    value === "providers" ||
    value === "review" ||
    value === "extensions" ||
    value === "inspector"
    ? value
    : "new-task";
}

export function VisualFixture() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const value = new URLSearchParams(window.location.search).get("theme");
    return value === "dark" || value === "light" ? value : "system";
  });
  const scene = sceneFromLocation();
  const visualError = new URLSearchParams(window.location.search).get("error");
  const sessionScene = scene === "thread" || scene === "review" || scene === "inspector";

  const sidebar = (
    <Sidebar
      open={sidebarOpen}
      workspace={workspace}
      workspaceName="lumencortex"
      groups={groups}
      recentProjects={[workspace, "/Users/demo/Projects/runtime"]}
      selectedSessionId={sessionScene ? session.id : ""}
      providerActive={scene === "providers"}
      extensionsActive={scene === "extensions"}
      runtimeState="online"
      runtimeVersion="0.1.0"
      themePreference={themePreference}
      labels={sidebarLabels}
      onClose={() => setSidebarOpen(false)}
      onNewTask={noop}
      onPickWorkspace={noop}
      onOpenWorkspace={noop}
      onSelectSession={noop}
      onRenameSession={noop}
      onPinSession={noop}
      onArchiveSession={noop}
      onOpenProviders={noop}
      onOpenExtensions={noop}
      onSwitchLocale={noop}
      onThemePreferenceChange={setThemePreference}
    />
  );

  const title =
    scene === "providers" ? labels.providerSettings :
    scene === "extensions" ? labels.extensions :
    scene === "review" ? labels.review :
    scene === "new-task" ? "lumencortex" :
    session.goal;
  const subtitle =
    scene === "providers" ? "Global & project configuration" :
    scene === "extensions" ? "MCP · Skills · Permissions" :
    scene === "review" ? "3 changed files · Local" :
    scene === "new-task" ? "Local" :
    "Worktree · GPT-5.6 · Active";

  return (
    <AppShell
      sidebar={sidebar}
      sidebarOpen={sidebarOpen}
      inspectorOpen={scene === "inspector"}
      inspector={scene === "inspector" ? <VisualInspectorFixture /> : undefined}
      closeLabel={labels.close}
      onCloseSidebar={() => setSidebarOpen(false)}
    >
      <VisualTopbar
        onOpenSidebar={() => setSidebarOpen(true)}
        title={title}
        subtitle={subtitle}
        inspectorActive={scene === "inspector"}
      />

      {scene === "new-task" && (
        <NewTaskComposer
          title={labels.buildTitle}
          subtitle={labels.newTaskSubtitle}
          placeholder={labels.composerPlaceholder}
          workspace={workspace}
          workspaceName="lumencortex"
          recentProjects={[workspace, "/Users/demo/Projects/runtime"]}
          recentProjectsLabel={labels.recentProjects}
          chooseProjectLabel={labels.openProject}
          modelLabel={labels.modelSelect}
          modelSearchLabel={labels.modelSearch}
          noModelMatchesLabel={labels.noModelMatches}
          modelRef="openai/gpt-5.6"
          models={[
            { ref: "openai/gpt-5.6", label: "GPT-5.6", group: "OpenAI", description: "128K ctx · 16K out", badge: labels.defaultModel },
            { ref: "deepseek/coder", label: "DeepSeek Coder", group: "DeepSeek", description: "64K ctx · 8K out", badge: labels.missingProviderKey, badgeTone: "warning" },
          ]}
          noModelsLabel={labels.modelFallback}
          contextPaths={["frontend/src/App.tsx", "internal/backend"]}
          contextLabels={{ context: labels.context, files: labels.attachFiles, folder: labels.attachFolder, remove: labels.removeContext }}
          policyLabel={labels.policy}
          policy="workspace"
          policyLabels={{ "read-only": labels.readOnly, workspace: labels.workspace, full: labels.full }}
          policyDescriptions={{
            "read-only": labels.readOnlyDescription,
            workspace: labels.workspaceDescription,
            full: labels.fullDescription,
          }}
          environmentLabel={labels.environment}
          runtime="worktree"
          runtimeLabels={{ local: labels.localRuntime, worktree: labels.worktreeRuntime }}
          runtimeDescriptions={{ local: labels.localRuntimeDescription, worktree: labels.worktreeRuntimeDescription }}
          hint={labels.composerHint}
          startLabel={labels.start}
          goal={goal}
          busy={false}
          textareaRef={null}
          onGoalChange={setGoal}
          onModelChange={noop}
          onPickContextFiles={noop}
          onPickContextFolder={noop}
          onRemoveContextPath={noop}
          onPolicyChange={noop}
          onRuntimeChange={noop}
          onPickWorkspace={noop}
          onOpenWorkspace={noop}
          onOpenProviders={noop}
          onSubmit={(event) => event.preventDefault()}
          onKeyDown={noop}
        />
      )}

      {(scene === "thread" || scene === "inspector") && <VisualThreadScene goal={goal} onGoalChange={setGoal} />}

      {scene === "providers" && (
        <ProviderSettingsPanel
          locale="en"
          workspace={workspace}
          effectiveCatalog={providerCatalog}
          selectedModelRef="openai/gpt-5.6"
          onSelectedModelRef={noop}
          onEffectiveCatalogChange={noop}
          onError={noop}
        />
      )}

      {scene === "review" && (
        <WorkspaceReviewRoute
          session={session}
          runtime={localRuntime}
          messages={reviewMessages}
          busy={false}
          running={false}
          labels={labels}
          onSendInstruction={async () => undefined}
        />
      )}

      {scene === "extensions" && (
        <WorkspaceExtensionsRoute
          workspace={workspace}
          sessionId={session.id}
          runtime={localRuntime}
          labels={labels}
          onError={noop}
        />
      )}

      <WorkspaceOverlays
        cleanupOpen={false}
        busy={false}
        error={visualError === "provider" ? "provider model not found" : ""}
        labels={labels}
        onCleanupOpenChange={noop}
        onCleanup={noop}
        errorActionLabel={visualError === "provider" ? labels.providerConfig : undefined}
        onErrorAction={noop}
        onClearError={noop}
      />
    </AppShell>
  );
}
