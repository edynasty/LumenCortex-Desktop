import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyThemePreference, initialThemePreference } from "./lib/theme";
import { visualApp } from "./visual/app-stub";
import { visualEvents } from "./visual/fixture-data";
import "./app-styles";

// Visual QA entry: the production App over the in-memory Core in visual/app-stub.ts.
// ?locale=en|zh-CN  ?theme=light|dark  ?project=none (welcome)  ?sidebar=collapsed
const params = new URLSearchParams(window.location.search);
// Each load starts from a clean preference state so screenshots are deterministic. The rail's
// plugin visibility is the one preference a test reloads to verify it persisted, so it survives.
const railPlugins = localStorage.getItem("lcx-rail-plugins");
localStorage.clear();
if (railPlugins) localStorage.setItem("lcx-rail-plugins", railPlugins);
localStorage.setItem("lcx-locale", params.get("locale") === "en" ? "en" : "zh-CN");
const theme = params.get("theme");
if (theme === "light" || theme === "dark") localStorage.setItem("lcx-theme", theme);
if (params.get("sidebar") === "collapsed") localStorage.setItem("lcx-layout", JSON.stringify({ collapsed: true }));
localStorage.setItem("lcx-recent-projects", JSON.stringify(["/Users/demo/Projects/lumencortex", "/Users/demo/Projects/runtime"]));
const app = visualApp(params.get("project") !== "none");
// ?menu=native pretends the macOS menu bar is installed: the webview's own ⌘K ⌘, ⌘N ⌘B stand down.
if (params.get("menu") === "native") app.SetMenuLocale = async () => true;
Object.defineProperty(window, "go", { configurable: true, value: { main: { App: app } } });
// Runtime events arrive once, shortly after start, to whichever listeners are subscribed then
// (the app resubscribes when its handlers change, as with the real Wails runtime).
const listeners = new Map<string, Set<(event: unknown) => void>>();
const forName = (name: string) => listeners.get(name) ?? listeners.set(name, new Set()).get(name)!;
window.setTimeout(() => visualEvents.forEach((event) => forName("runtime:event").forEach((listener) => listener(event))), 400);
// Tests send a native menu command the way Go's EventsEmit does.
Object.defineProperty(window, "__lcxEmit", { configurable: true, value: (name: string, payload: unknown) => forName(name).forEach((listener) => listener(payload)) });
Object.defineProperty(window, "runtime", {
  configurable: true,
  value: {
    EventsOn: (name: string, callback: (event: unknown) => void) => {
      forName(name).add(callback);
      return () => forName(name).delete(callback);
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
