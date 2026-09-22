import React from "react";
import ReactDOM from "react-dom/client";
import { VisualFixture } from "./visual/VisualFixture";
import { installVisualAppStub } from "./visual/fixture-data";
import { applyThemePreference, type ThemePreference } from "./lib/theme";
import "./styles/tokens.css";
import "./styles/global.css";
import "./components/primitives/primitives.css";
import "./styles.css";
import "./components/inspector/inspector.css";
import "./components/sidebar/sidebar.css";

installVisualAppStub();

const themeParam = new URLSearchParams(window.location.search).get("theme");
const visualTheme: ThemePreference =
  themeParam === "dark" || themeParam === "light" ? themeParam : "system";
applyThemePreference(visualTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VisualFixture />
  </React.StrictMode>
);
