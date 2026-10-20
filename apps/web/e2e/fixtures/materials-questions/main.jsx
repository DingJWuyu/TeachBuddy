import React from "react";
import { createRoot } from "react-dom/client";
import MaterialsQuestionsPage from "../../../src/features/questions/MaterialsQuestionsPage.jsx";
import { bindWorkbenchTransport } from "../../../src/platform/http/apiClient.js";
import "../../../src/styles/global.css";
import "./style.css";
const transport = window.fetch.bind(window);
bindWorkbenchTransport(transport);
createRoot(document.getElementById("root")).render(
  <div className="wb-shell" data-theme="light"><MaterialsQuestionsPage accountKey="r33-a" transport={transport} /></div>,
);
