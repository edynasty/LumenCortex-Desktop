import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyThemePreference, initialThemePreference } from "./lib/theme";
import { visualApp } from "./visual/app-stub";
import { visualEvents } from "./visual/fixture-data";
import "./app-styles";

// Visual QA entry: the production App over the in-memory Core in visual/app-stub.ts.
// ?locale=en|zh-CN  ?theme=light|dark  ?project=none (welcome)  ?sidebar=collapsed
// Each load starts from a clean preference state so screenshots are deterministic.
const params = new URLSearchParams(window.location.search);
localStorage.clear();
localStorage.setItem("lcx-locale", params.get("locale") === "en" ? "en" : "zh-CN");
const theme = params.get("theme");
if (theme === "light" || theme === "dark") localStorage.setItem("lcx-theme", theme);
if (params.get("sidebar") === "collapsed") localStorage.setItem("lcx-layout", JSON.stringify({ collapsed: true }));
localStorage.setItem("lcx-recent-projects", JSON.stringify(["/Users/demo/Projects/lumencortex", "/Users/demo/Projects/runtime"]));
Object.defineProperty(window, "go", { configurable: true, value: { main: { App: visualApp(params.get("project") !== "none") } } });
// Runtime events arrive once, shortly after start, to whichever listeners are subscribed then
// (the app resubscribes when its handlers change, as with the real Wails runtime).
const listeners = new Set<(event: unknown) => void>();
window.setTimeout(() => visualEvents.forEach((event) => listeners.forEach((listener) => listener(event))), 400);
Object.defineProperty(window, "runtime", {
  configurable: true,
  value: {
    EventsOn: (_name: string, callback: (event: unknown) => void) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  },
});
if (params.get("chrome") === "mac-inset") document.documentElement.dataset.chrome = "mac-inset";

applyThemePreference(initialThemePreference());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
