import { useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { bridge, onTerminalExit, onTerminalOutput } from "../../lib/bridge";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";

type Props = {
  // The open workspace; the shell restarts in the new directory when it changes.
  workspace: string;
  workspaceOpen: boolean;
  // The terminal stays mounted while another inspector tab is shown, so a running command
  // survives a look at Task or Checks; it is refitted when it becomes visible again.
  visible: boolean;
  labels: AppCopy;
};

type Status = "idle" | "starting" | "running" | "exited" | "failed";

/** Reads the live design tokens so the terminal follows the app theme, not a hardcoded palette. */
function readTheme() {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    background: token("--bg-window", "#0b111c"),
    foreground: token("--fg", "#e9eef7"),
    cursor: token("--accent", "#4d97ff"),
    cursorAccent: token("--bg-window", "#0b111c"),
    selectionBackground: token("--accent-soft", "rgba(77, 151, 255, 0.25)"),
    selectionForeground: token("--fg", "#e9eef7"),
  };
}

/** pty bytes arrive base64 (they are not always valid UTF-8); xterm writes bytes. */
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// TerminalPanel is a real login shell in the workspace, drawn by xterm (terminal.go on the Go
// side). One shell per workspace; "new terminal" restarts it; unmount closes it.
export default function TerminalPanel({ workspace, workspaceOpen, visible, labels }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const idRef = useRef("");
  const [status, setStatus] = useState<Status>("idle");
  const [exitCode, setExitCode] = useState(0);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);

  const fit = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitRef.current;
    const host = hostRef.current;
    if (!terminal || !fitAddon || !host || host.clientWidth === 0 || host.clientHeight === 0) return;
    try {
      fitAddon.fit();
    } catch {
      return;
    }
    const id = idRef.current;
    if (id) void bridge.terminalResize(id, terminal.cols, terminal.rows).catch(() => undefined);
  }, []);

  // One xterm instance for the pane's life; it is only created once the terminal is shown.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace",
      fontSize: 12,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: readTheme(),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    terminalRef.current = terminal;
    fitRef.current = fitAddon;
    const dispose = terminal.onData((data) => {
      const id = idRef.current;
      if (id) void bridge.terminalWrite(id, data).catch(() => undefined);
    });

    // Follow the app theme: the tokens are replaced when the preference changes.
    const observer = new MutationObserver(() => {
      terminal.options.theme = readTheme();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });

    return () => {
      observer.disconnect();
      dispose.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Output and exit notices are app-wide events; only this terminal's are written.
  useEffect(() => {
    const stopOutput = onTerminalOutput((event) => {
      if (event.id !== idRef.current) return;
      try {
        terminalRef.current?.write(decodeBase64(event.data));
      } catch {
        // A malformed chunk is dropped; the shell keeps running.
      }
    });
    const stopExit = onTerminalExit((event) => {
      if (event.id !== idRef.current) return;
      idRef.current = "";
      setExitCode(event.code);
      setStatus("exited");
    });
    return () => {
      stopOutput();
      stopExit();
    };
  }, []);

  // Start the shell (and restart it when the workspace changes or "new terminal" is pressed).
  // Switching inspector tabs only hides the pane, so it never restarts the shell.
  useEffect(() => {
    const terminal = terminalRef.current;
    const previous = idRef.current;
    idRef.current = "";
    if (previous) void bridge.terminalClose(previous).catch(() => undefined);
    if (!terminal || !workspaceOpen) return;
    let cancelled = false;
    terminal.reset();
    setStatus("starting");
    setError("");
    fit();
    void bridge
      .terminalStart("", terminal.cols || 80, terminal.rows || 24)
      .then((id) => {
        if (cancelled) {
          void bridge.terminalClose(id).catch(() => undefined);
          return;
        }
        idRef.current = id;
        setStatus("running");
        fit();
      })
      .catch((reason) => {
        if (cancelled) return;
        setStatus("failed");
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, workspaceOpen, generation, fit]);

  // The pane outlives tab switches; closing it (or the app window) closes the shell.
  useEffect(
    () => () => {
      const id = idRef.current;
      idRef.current = "";
      if (id) void bridge.terminalClose(id).catch(() => undefined);
    },
    []
  );

  // Refit whenever the pane is shown or the inspector is resized.
  useEffect(() => {
    if (!visible) return;
    const host = hostRef.current;
    if (!host) return;
    fit();
    terminalRef.current?.focus();
    const observer = new ResizeObserver(() => fit());
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible, fit]);

  if (!workspaceOpen) {
    return <p className="tp-pane-muted files-note">{labels.terminalNoWorkspace}</p>;
  }

  return (
    <div className="terminal-pane">
      <header className="pane-head">
        <h4>{labels.terminal}</h4>
        <span className="toolbar-spacer" />
        <IconButton
          size="sm"
          label={labels.terminalNew}
          icon={<Icon name="refresh" size={13} />}
          onClick={() => setGeneration((value) => value + 1)}
        />
      </header>
      {status === "starting" ? <p className="tp-pane-muted files-note">{labels.terminalStarting}</p> : null}
      {status === "exited" ? (
        <p className="tp-pane-muted files-note">{labels.terminalExited.replace("{code}", String(exitCode))}</p>
      ) : null}
      {status === "failed" ? <p className="tp-pane-error">{`${labels.terminalFailed}: ${error}`}</p> : null}
      <div className="terminal-host" ref={hostRef} />
    </div>
  );
}
