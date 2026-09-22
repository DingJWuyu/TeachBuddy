import { PUBLIC_AUTH } from "../../../src/features/auth/AuthProvider.jsx";
import React from "react";
import { createRoot } from "react-dom/client";
import WorkbenchApp from "../../../src/features/workbench/WorkbenchApp.jsx";
import { bindWorkbenchTransport } from "../../../src/features/workbench/apiClient.js";
import "../../../src/features/workbench/workbench.css";
import "../../../src/features/workbench/materials/materials.css";
bindWorkbenchTransport((url, options) => fetch(url, options));
createRoot(document.getElementById("root")).render(
  <PUBLIC_AUTH.Provider
    value={{ request: (url, options) => fetch(url, options) }}
  >
    <WorkbenchApp
      boot={{
        accountKey: "r34-a",
        nickname: "数学备课",
        generation: 1,
        storageFailed: false,
        logout: () => {},
        reportIdentityLost: () => {
          location.href = "/fixture/session";
        },
      }}
    />
  </PUBLIC_AUTH.Provider>,
);
