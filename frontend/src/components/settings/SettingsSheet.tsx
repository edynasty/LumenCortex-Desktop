/*
 * Settings: one sheet over any page (⌘,). Panes are the product's real configuration surfaces:
 * appearance, the provider/model catalogue, tool permissions, MCP servers, skills, workspace
 * trust and identity. The sheet stays mounted after its first open so unsaved provider and
 * extension edits survive closing it.
 */
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import type { ThemePreference } from "../../lib/theme";
import type { ConfigState, Health, SessionRuntime } from "../../types";
import { ExtensionsWorkspace } from "../extensions/ExtensionsWorkspace";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import type { IconName } from "../primitives/icons";
import { Modal } from "../primitives/Modal";
import { ProviderSettingsPanel } from "../provider/ProviderSettingsPanel";
import { extensionsLabels } from "./extensions-labels";
import { AboutPane, GeneralPane, WorkspacePane } from "./SettingsPanes";

export type SettingsPane = "general" | "models" | "permissions" | "mcp" | "skills" | "workspace" | "about";

const NAV: { pane: SettingsPane; icon: IconName; label: keyof AppCopy }[] = [
  { pane: "general", icon: "tune", label: "settingsGeneral" },
  { pane: "models", icon: "model", label: "settingsModels" },
  { pane: "permissions", icon: "permission", label: "settingsPermissions" },
  { pane: "mcp", icon: "mcp", label: "settingsMcp" },
  { pane: "skills", icon: "skill", label: "settingsSkills" },
  { pane: "workspace", icon: "lock", label: "settingsTrust" },
  { pane: "about", icon: "about", label: "settingsAbout" },
];

type Props = {
  open: boolean;
  pane: SettingsPane;
  locale: Locale;
  labels: AppCopy;
  themePreference: ThemePreference;
  workspace: string;
  config: ConfigState;
  trusting: boolean;
  health?: Health;
  sessionId: string;
  runtime: SessionRuntime;
  onPaneChange: (pane: SettingsPane) => void;
  onClose: () => void;
  onLocaleChange: (locale: Locale) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  onTrust: () => void;
  onConfigChanged: () => void;
  onError: (message: string) => void;
};

export function SettingsSheet(props: Props) {
  const { open, pane, labels, workspace } = props;
  const title = labels[NAV.find((item) => item.pane === pane)!.label] as string;
  const extensionsTab = pane === "permissions" || pane === "mcp" || pane === "skills" ? pane : null;

  return (
    <Modal label={labels.settings} onClose={props.onClose} className="settings-sheet" hidden={!open}>
      <nav className="settings-nav" aria-label={labels.settings}>
        <h2>{labels.settings}</h2>
        {NAV.map((item) => (
          <button
            key={item.pane}
            type="button"
            className={`settings-nav-item ${pane === item.pane ? "is-selected" : ""}`}
            aria-current={pane === item.pane ? "page" : undefined}
            title={labels[item.label] as string}
            onClick={() => props.onPaneChange(item.pane)}
          >
            <Icon name={item.icon} size={15} />
            {labels[item.label] as string}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        <header className="settings-head">
          <h3>{title}</h3>
          <IconButton icon={<Icon name="close" />} label={labels.close} onClick={props.onClose} />
        </header>
        <div className="settings-scroll">
          {pane === "general" && (
            <GeneralPane
              locale={props.locale}
              labels={labels}
              themePreference={props.themePreference}
              config={props.config}
              onLocaleChange={props.onLocaleChange}
              onThemePreferenceChange={props.onThemePreferenceChange}
              onOpenModels={() => props.onPaneChange("models")}
              onConfigChanged={props.onConfigChanged}
              onError={props.onError}
            />
          )}
          {/* Mounted once opened and hidden on other panes: unsaved provider edits survive pane switches. */}
          <div hidden={pane !== "models"}>
            {workspace ? (
              <ProviderSettingsPanel
                locale={props.locale}
                workspace={workspace}
                config={props.config}
                trusting={props.trusting}
                onTrust={props.onTrust}
                onConfigChanged={props.onConfigChanged}
                onError={props.onError}
              />
            ) : (
              <p className="pane-intro">{labels.settingsNoProject}</p>
            )}
          </div>
          {extensionsTab && (workspace ? (
            <ExtensionsWorkspace
              tab={extensionsTab}
              workspace={workspace}
              sessionId={props.sessionId}
              runtime={props.runtime}
              labels={extensionsLabels(labels)}
              onError={props.onError}
            />
          ) : (
            <p className="pane-intro">{labels.settingsNoProject}</p>
          ))}
          {pane === "workspace" && (
            <WorkspacePane labels={labels} workspace={workspace} config={props.config} trusting={props.trusting} onTrust={props.onTrust} />
          )}
          {pane === "about" && <AboutPane labels={labels} health={props.health} workspace={workspace} />}
        </div>
      </div>
    </Modal>
  );
}
