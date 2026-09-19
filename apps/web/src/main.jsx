import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import DevSurfaceSwitcher from '../../../prototype/src/DevSurfaceSwitcher.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {import.meta.env.DEV && <DevSurfaceSwitcher active="app" />}
  </React.StrictMode>
);
