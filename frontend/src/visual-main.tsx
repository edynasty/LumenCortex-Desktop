import React from "react";
import ReactDOM from "react-dom/client";
import { VisualFixture } from "./visual/VisualFixture";
import { installVisualAppStub } from "./visual/fixture-data";
import "./styles/tokens.css";
import "./styles/global.css";
import "./components/primitives/primitives.css";
import "./components/sidebar/sidebar.css";
import "./components/inspector/inspector.css";
import "./styles.css";

installVisualAppStub();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VisualFixture />
  </React.StrictMode>
);
