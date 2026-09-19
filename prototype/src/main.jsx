import React from 'react';
import ReactDOM from 'react-dom/client';
import SidebarEditingPrototype from './SidebarEditingPrototype.jsx';
import DevSurfaceSwitcher from './DevSurfaceSwitcher.jsx';
import '@workspace-styles';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SidebarEditingPrototype />
    {import.meta.env.DEV && <DevSurfaceSwitcher active="prototype" />}
  </React.StrictMode>
);
