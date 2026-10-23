/*
 * The binary's build identity (GetBuildInfo): the Desktop version and commit, the Core module and
 * runtime versions, the toolchain and the build time. The app version is the Desktop release from
 * wails.json — Core's runtime version is a separate row, never the app version.
 */
import { useEffect, useState } from "react";
import type { BuildInfo } from "../types";
import { bridge } from "./bridge";
import type { AppCopy, Locale } from "./i18n/app-copy";

/** Read once per consumer; the identity of a running binary never changes. */
export function useBuildInfo(): BuildInfo | null {
  const [info, setInfo] = useState<BuildInfo | null>(null);
  useEffect(() => {
    let live = true;
    // Deferred so a missing bridge (unit tests, a plain browser) rejects instead of throwing here.
    Promise.resolve()
      .then(() => bridge.buildInfo())
      .then(
        (value) => { if (live) setInfo(value); },
        () => undefined,
      );
    return () => { live = false; };
  }, []);
  return info;
}

/** `v0.1.0` for the rail. */
export function versionLabel(info: BuildInfo | null): string {
  return info?.appVersion ? `v${info.appVersion}` : "";
}

/** The short hash, keeping the build script's dirty marker. */
export function shortCommit(commit: string): string {
  if (!commit || commit === "unknown") return commit || "—";
  const dirty = commit.endsWith("-dirty");
  const sha = dirty ? commit.slice(0, -"-dirty".length) : commit;
  return `${sha.slice(0, 7)}${dirty ? "-dirty" : ""}`;
}

/** The build time in the UI's locale; `—` when a dev build carries none. */
export function formatBuiltAt(builtAt: string | undefined, locale: Locale): string {
  if (!builtAt) return "—";
  const date = new Date(builtAt);
  if (Number.isNaN(date.getTime())) return builtAt;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export type BuildRow = { key: string; label: string; value: string };

/** The About rows, in reading order. A local `replace` is named as such instead of looking released. */
export function buildRows(info: BuildInfo | null, labels: AppCopy, locale: Locale): BuildRow[] {
  if (!info) return [];
  const core = info.coreLocal
    ? `${info.coreVersion || "—"} · ${labels.aboutCoreLocal}${info.coreLocalPath ? ` (${info.coreLocalPath})` : ""}`
    : info.coreVersion || "—";
  return [
    { key: "app", label: labels.aboutVersion, value: versionLabel(info) || "—" },
    { key: "core", label: labels.aboutCoreModule, value: core },
    { key: "runtime", label: labels.aboutCoreRuntime, value: info.coreRuntimeVersion || "—" },
    { key: "commit", label: labels.aboutCommit, value: shortCommit(info.commit) },
    { key: "builtAt", label: labels.aboutBuiltAt, value: formatBuiltAt(info.builtAt, locale) },
    { key: "go", label: labels.aboutGoVersion, value: info.goVersion || "—" },
    { key: "platform", label: labels.aboutPlatform, value: `${info.goos || "—"}/${info.goarch || "—"}` },
  ];
}

/** What "Copy version info" writes: the same rows, plus the project and database paths. */
export function versionSummary(info: BuildInfo | null, labels: AppCopy, locale: Locale, workspace: string, database: string): string {
  const rows = [
    ...buildRows(info, labels, locale),
    { key: "workspace", label: labels.aboutWorkspace, value: workspace || "—" },
    { key: "database", label: labels.aboutDatabase, value: database || "—" },
  ];
  return rows.map((row) => `${row.label}: ${row.value}`).join("\n");
}
