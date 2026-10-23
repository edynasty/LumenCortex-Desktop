import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { bridge } from "../../lib/bridge";
import type { DirEntry, DirListing } from "../../types";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import type { IconName } from "../primitives/icons";

type Props = {
  // The open workspace; a change resets the tree to the new root.
  workspace: string;
  workspaceOpen: boolean;
  labels: AppCopy;
};

type LoadState = {
  listings: Record<string, DirListing>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  expanded: Record<string, boolean>;
};

const emptyState: LoadState = { listings: {}, loading: {}, errors: {}, expanded: {} };

const IMAGE_EXTENSIONS: Record<string, true> = { png: true, jpg: true, jpeg: true, gif: true, svg: true, webp: true, ico: true, bmp: true, tif: true, tiff: true, avif: true };
const ARCHIVE_EXTENSIONS: Record<string, true> = { zip: true, tar: true, gz: true, tgz: true, bz2: true, xz: true, "7z": true, rar: true, dmg: true };
const DATA_EXTENSIONS: Record<string, true> = { json: true, jsonc: true, yaml: true, yml: true, toml: true, ini: true, conf: true, config: true, xml: true, plist: true, lock: true, csv: true };
const TEXT_EXTENSIONS: Record<string, true> = { md: true, mdx: true, txt: true, rst: true, adoc: true, log: true, env: true };

/** One glyph per file kind, so a row is readable before its name is. */
export function fileGlyph(entry: DirEntry): IconName {
  if (entry.kind === "dir") return "folder";
  if (entry.kind === "symlink") return "symlink";
  const name = entry.name.toLowerCase();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (IMAGE_EXTENSIONS[extension]) return "fileImage";
  if (ARCHIVE_EXTENSIONS[extension]) return "fileArchive";
  if (DATA_EXTENSIONS[extension]) return "fileData";
  if (TEXT_EXTENSIONS[extension]) return "fileText";
  return "file";
}

/** Copies text; the Clipboard API is missing in some webviews and in jsdom. */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

// FilesPanel is the inspector's file tree: one Core listing per expanded directory, loaded when
// the directory is first opened, with a refresh that reloads the root and every open branch.
export function FilesPanel({ workspace, workspaceOpen, labels }: Props) {
  const [state, setState] = useState<LoadState>(emptyState);
  const [copied, setCopied] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const copiedTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async (path: string) => {
    setState((current) => ({ ...current, loading: { ...current.loading, [path]: true } }));
    try {
      const listing = await bridge.listDir(path);
      setState((current) => {
        const errors = { ...current.errors };
        delete errors[path];
        return { ...current, listings: { ...current.listings, [path]: listing }, errors, loading: { ...current.loading, [path]: false } };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: { ...current.loading, [path]: false },
        errors: { ...current.errors, [path]: error instanceof Error ? error.message : String(error) },
      }));
    }
  }, []);

  // A new workspace starts from an empty tree.
  useEffect(() => {
    setState(emptyState);
  }, [workspace]);

  // One listing per directory that is shown: the root, plus every open directory. A directory is
  // read the first time it is opened and kept until a refresh clears the cache; a failed read is
  // not retried until then, so an unreadable directory cannot spin.
  useEffect(() => {
    if (!workspaceOpen) return;
    const wanted = ["", ...Object.keys(state.expanded).filter((path) => state.expanded[path])];
    for (const path of wanted) {
      if (!state.listings[path] && !state.loading[path] && !state.errors[path]) void load(path);
    }
  }, [workspaceOpen, state.expanded, state.listings, state.loading, state.errors, load]);

  // Refresh drops the cache and keeps the open branches; the effect above reads them again.
  useEffect(() => {
    if (refreshKey === 0) return;
    setState((current) => ({ ...current, listings: {}, loading: {}, errors: {} }));
  }, [refreshKey]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const toggle = useCallback((path: string) => {
    setState((current) => ({ ...current, expanded: { ...current.expanded, [path]: !current.expanded[path] } }));
  }, []);

  const copy = async (path: string) => {
    try {
      await copyText(path);
      setCopied(path);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  };

  const reveal = (path: string) => {
    void bridge.revealInFinder(path).catch(() => undefined);
  };

  const rows = useMemo(() => {
    const render = (path: string, depth: number): JSX.Element[] => {
      const listing = state.listings[path];
      if (!listing) {
        const error = state.errors[path];
        return error && depth > 0 ? [
          <p key={`error-${path}`} className="tp-pane-error file-row-error" style={{ paddingLeft: 20 + depth * 12 }}>
            {`${labels.filesError}: ${error}`}
          </p>,
        ] : [];
      }
      return listing.entries.flatMap((entry) => {
        const open = entry.kind === "dir" && Boolean(state.expanded[entry.path]);
        const row = (
          <div key={entry.path} className="file-row" role="treeitem" aria-level={depth + 1} aria-expanded={entry.kind === "dir" ? open : undefined}>
            {entry.kind === "dir" ? (
              <button
                type="button"
                className="file-row-main"
                style={{ paddingLeft: 4 + depth * 12 }}
                aria-expanded={open}
                onClick={() => toggle(entry.path)}
              >
                <Icon name={open ? "collapse" : "expand"} size={12} className="file-row-chevron" />
                <Icon name={open ? "folderOpen" : "folder"} size={14} className="file-row-glyph" />
                <span className="file-row-name">{entry.name}</span>
              </button>
            ) : (
              <span className="file-row-main" style={{ paddingLeft: 4 + depth * 12 }}>
                <span className="file-row-chevron" aria-hidden />
                <Icon name={fileGlyph(entry)} size={14} className="file-row-glyph" />
                <span className="file-row-name">{entry.name}</span>
              </span>
            )}
            <span className="file-row-actions">
              <IconButton
                size="sm"
                label={copied === entry.path ? labels.filesCopied : labels.filesCopyPath}
                icon={<Icon name={copied === entry.path ? "checkmark" : "copy"} size={12} />}
                onClick={() => void copy(entry.path)}
              />
              <IconButton
                size="sm"
                label={labels.filesReveal}
                icon={<Icon name="reveal" size={12} />}
                onClick={() => reveal(entry.path)}
              />
            </span>
          </div>
        );
        return open ? [row, ...render(entry.path, depth + 1)] : [row];
      });
    };
    return render("", 0);
  }, [state.listings, state.errors, state.expanded, copied, labels]);

  if (!workspaceOpen) {
    return <p className="tp-pane-muted files-note">{labels.filesNoWorkspace}</p>;
  }

  const root = state.listings[""];
  const rootError = state.errors[""];
  const rootLoading = state.loading[""];
  return (
    <div className="files-pane">
      <header className="pane-head">
        <h4>{labels.files}</h4>
        <span className="tp-pane-count">{root ? root.entries.length : ""}</span>
        <span className="toolbar-spacer" />
        <IconButton
          size="sm"
          label={labels.filesRefresh}
          icon={<Icon name="refresh" size={13} />}
          onClick={() => setRefreshKey((key) => key + 1)}
        />
      </header>
      {rootError ? <p className="tp-pane-error">{`${labels.filesError}: ${rootError}`}</p> : null}
      {rootLoading && !root ? <p className="tp-pane-muted files-note">{labels.filesLoading}</p> : null}
      {root && root.entries.length === 0 ? <p className="tp-pane-muted files-note">{labels.filesEmpty}</p> : null}
      <div className="files-tree" role="tree" aria-label={labels.files}>
        {rows}
      </div>
      {root?.truncated ? (
        <p className="tp-pane-muted files-note">{labels.filesTruncated}</p>
      ) : null}
    </div>
  );
}
