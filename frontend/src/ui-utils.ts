import type { Copy } from "./i18n";
import type { Message, RuntimeEvent } from "./types";

export function bytes(value = 0) {
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  if (value < 1024 * 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + " MB";
  return (value / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export function normalizePayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { content: value };
    }
  }
  return {};
}

export function messageText(message: Message, locale: "zh" | "en") {
  const payload = normalizePayload(message.json);
  if (typeof payload.content === "string" && payload.content.trim()) {
    return payload.content;
  }
  if (Array.isArray(payload.tool_calls)) {
    const names = payload.tool_calls
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const call = item as Record<string, unknown>;
        return typeof call.name === "string" ? call.name : "";
      })
      .filter(Boolean);
    if (names.length) {
      return (locale === "zh" ? "工具调用：" : "Tool calls: ") + names.join(", ");
    }
  }
  const raw = JSON.stringify(payload, null, 2);
  return raw === "{}" ? (locale === "zh" ? "（空消息）" : "(empty message)") : raw;
}

export function eventSummary(event: RuntimeEvent) {
  if (!event.data) return "";
  const preferred = ["tool", "name", "command", "status", "phase", "message"];
  for (const key of preferred) {
    const value = event.data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  const raw = JSON.stringify(event.data);
  return raw === "{}" ? "" : raw;
}

export function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function statusText(copy: Copy, status?: string) {
  if (!status) return "";
  if (status === "running") return copy.running;
  if (status === "created") return copy.created;
  if (status === "completed") return copy.completed;
  if (status === "interrupted") return copy.interrupted;
  if (status === "waiting_gate") return copy.waiting_gate;
  return status;
}

export function roleText(copy: Copy, role: string) {
  if (role === "user") return copy.user;
  if (role === "assistant") return copy.assistant;
  if (role === "tool") return copy.tool;
  if (role === "system") return copy.system;
  return role;
}
