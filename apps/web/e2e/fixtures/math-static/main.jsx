import React from "react";
import { createRoot } from "react-dom/client";
import { MathWorkbench } from "../../../src/features/math/index.jsx";
import { AuthProvider, AuthGate, useAuth } from "../../../src/features/auth/index.jsx";
const nativeTest = new URLSearchParams(location.search).has('testPrincipal');
function MathPage() {
  const { logout } = useAuth();
  return <><button className="math-logout" onClick={() => logout()}>退出登录</button><MathWorkbench /></>;
}
createRoot(document.getElementById("root")).render(nativeTest
  ? <MathWorkbench transport={window.fetch.bind(window)} />
  : <AuthProvider><AuthGate><MathPage /></AuthGate></AuthProvider>);
