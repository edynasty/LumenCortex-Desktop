import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isNativeMacWindow } from "./lib/bridge";
import { applyThemePreference, initialThemePreference } from "./lib/theme";
import "./app-styles";

applyThemePreference(initialThemePreference());
if (isNativeMacWindow()) document.documentElement.dataset.chrome = "mac-inset";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
