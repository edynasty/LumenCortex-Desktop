/*
 * Which plugins ride in the rail: a Desktop UI preference, stored as the hidden plugin ids. The
 * default is visible, so a plugin that gains a primary entry appears without any stored choice.
 * A tiny external store keeps the rail and the Plugins page in step without a prop chain.
 */
import { useSyncExternalStore } from "react";

const KEY = "lcx-rail-plugins";
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: string[] = [];

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

// The snapshot is the parsed value, cached by its raw text so a test (or another window) that
// rewrites the key is observed without an extra subscription.
function snapshot(): string[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function setPluginRailVisible(id: string, visible: boolean): void {
  const next = new Set(snapshot());
  if (visible) next.delete(id);
  else next.add(id);
  const ids = [...next];
  const raw = JSON.stringify(ids);
  cachedRaw = raw;
  cached = ids;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // A full quota leaves the in-memory preference: the rail still hides it for this session.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) emit();
  });
}

export function useHiddenPluginIds(): ReadonlySet<string> {
  return new Set(useSyncExternalStore(subscribe, snapshot, () => cached));
}
