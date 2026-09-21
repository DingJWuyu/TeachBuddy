import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import SidebarEditingPrototype from './SidebarEditingPrototype.jsx';
import DevSurfaceSwitcher from './DevSurfaceSwitcher.jsx';
import AuthEntry from './auth/AuthEntry.jsx';
import { PrototypeAuth } from './auth/demo-data.js';
import '@workspace-styles';
import './auth/authEntry.css';

function App() {
  const auth = useMemo(() => new PrototypeAuth(), []);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');

  function signedIn(next) {
    setUser(next);

    document.body.className = 'tb-workbench';
  }

  function signIn({ email }) {
    signedIn(auth.signIn({ email }));
    return '';
  }

  function register({ name, email, password }) {
    try {
      signedIn(auth.register({ name, email, password }));
      return '';
    } catch (failure) {
      return failure.message;
    }
  }

  function confirmRecovery({ code }) {
    try {
      auth.resetPassword({ code });
      return '';
    } catch (failure) {
      return failure.message;
    }
  }

  if (!user) {
    return (
      <AuthEntry
        mode={mode}
        onModeChange={setMode}
        onSubmit={(values) => (values.name ? register(values) : signIn(values))}
        onConfirmRecovery={confirmRecovery}
        onCheckEmail={(email) => auth.isRegistered(email)}
      />
    );
  }

  return <SidebarEditingPrototype />;
}

const devChromeVisible = import.meta.env.DEV && !new URLSearchParams(window.location.search).has('no-dev-chrome');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {devChromeVisible && <DevSurfaceSwitcher active="prototype" />}
  </React.StrictMode>
);
