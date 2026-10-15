import React from "react";
import { createRoot } from "react-dom/client";
import MaterialsQuestionsPage from "../../../src/features/questions/MaterialsQuestionsPage.jsx";
import { bindWorkbenchTransport } from "../../../src/platform/http/apiClient.js";
import "./style.css";
const transport = window.fetch.bind(window);
bindWorkbenchTransport(transport);
createRoot(document.getElementById("root")).render(
  <MaterialsQuestionsPage accountKey="r33-a" transport={transport} />,
);
