import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import SidebarEditingPrototype from './prototypes/sidebar-editing/SidebarEditingPrototype.jsx';
import DevSurfaceSwitcher from './prototypes/sidebar-editing/DevSurfaceSwitcher.jsx';
/*
 * Import order is unchanged. global.css declares `button { font: inherit }`,
 * and because that is a shorthand it resets font-size on every prototype
 * button, clobbering the reference type ramp measured in
 * docs/reference/emstudio-sidebar-measured-spec.md. The prototype stylesheet
 * re-asserts its button type styles with explicit longhand properties, which
 * beat the shorthand at equal specificity regardless of import order.
 */
import './styles/global.css';

const searchParams = new URLSearchParams(window.location.search);
const showSidebarPrototype = import.meta.env.DEV && searchParams.get('prototype') === 'sidebar';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {showSidebarPrototype ? <SidebarEditingPrototype /> : <App />}
    {import.meta.env.DEV && (
      <DevSurfaceSwitcher active={showSidebarPrototype ? 'prototype' : 'app'} />
    )}
  </React.StrictMode>
);
