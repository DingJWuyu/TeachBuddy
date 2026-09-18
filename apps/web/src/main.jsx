import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import SidebarEditingPrototype from './prototypes/sidebar-editing/SidebarEditingPrototype.jsx';
import './styles/global.css';

const searchParams = new URLSearchParams(window.location.search);
const showSidebarPrototype = import.meta.env.DEV && searchParams.get('prototype') === 'sidebar';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {showSidebarPrototype ? <SidebarEditingPrototype /> : <App />}
  </React.StrictMode>
);
