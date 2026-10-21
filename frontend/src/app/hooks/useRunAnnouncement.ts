import { useEffect, useRef, useState } from "react";
import type { SidebarGroup } from "../../components/sidebar/Sidebar";
import { runAnnouncement, runSnapshot, type RunSnapshot } from "../../lib/run-announcement";

/** Text for the shell's live region; cleared after a few seconds so a repeat is announced again. */
export function useRunAnnouncement(groups: SidebarGroup[]): string {
  const [message, setMessage] = useState("");
  const previous = useRef<RunSnapshot | undefined>(undefined);

  useEffect(() => {
    const next = runSnapshot(groups);
    const text = runAnnouncement(previous.current, next);
    previous.current = next;
    if (text) setMessage(text);
  }, [groups]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  return message;
}
