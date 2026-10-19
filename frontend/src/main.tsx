import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isNativeMacWindow } from "./lib/bridge";
import { installTitleBarDoubleClick } from "./lib/titlebar";
import "./app-styles";

if (isNativeMacWindow()) {
  document.documentElement.dataset.chrome = "mac-inset";
  installTitleBarDoubleClick();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
