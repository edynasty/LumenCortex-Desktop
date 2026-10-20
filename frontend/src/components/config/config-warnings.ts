import type { AppCopy } from "../../lib/i18n/app-copy";
import type { ConfigWarning } from "../../types";

export type WarningLabels = Pick<
  AppCopy,
  "configWarningLegacyPath" | "configWarningCognition" | "configWarningDefaultLimit" | "configWarningGlobalOnly"
>;

export type WarningView = {
  // Dropped workspace entries share one trust prompt instead of one row each.
  untrustedKeys: string[];
  trustable: boolean;
  lines: string[];
};

function fill(template: string, values: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
}

// Core's warning codes are a closed set this build knows; a code it does not know is shown by the
// message Core sent, so a newer Core never hides a finding.
export function viewWarnings(labels: WarningLabels, warnings: ConfigWarning[], hideDefaultLimit = false): WarningView {
  const view: WarningView = { untrustedKeys: [], trustable: false, lines: [] };
  for (const warning of warnings) {
    switch (warning.code) {
      case "untrusted_override":
        if (warning.key && !view.untrustedKeys.includes(warning.key)) view.untrustedKeys.push(warning.key);
        if (warning.trustEntry) view.trustable = true;
        break;
      case "legacy_global_path":
        view.lines.push(fill(labels.configWarningLegacyPath, { path: warning.path, moveTo: warning.moveTo }));
        break;
      case "cognition_profile":
        view.lines.push(fill(labels.configWarningCognition, { path: warning.path }));
        break;
      case "default_limit":
        if (!hideDefaultLimit) view.lines.push(fill(labels.configWarningDefaultLimit, { key: warning.key }));
        break;
      case "global_only":
        view.lines.push(fill(labels.configWarningGlobalOnly, { key: warning.key }));
        break;
      default:
        view.lines.push(warning.message);
    }
  }
  return view;
}
