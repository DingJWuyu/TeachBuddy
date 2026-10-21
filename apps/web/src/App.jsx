import { AuthProvider, AuthGate } from './features/auth/index.jsx';
import WorkbenchRoot from './features/workbench/WorkbenchRoot.jsx';
import { clearDeletedAccountDeviceData } from './accountDeviceData.js';

export default function App() {
  return (
    <AuthProvider onAccountDeleted={clearDeletedAccountDeviceData}>
      <AuthGate><WorkbenchRoot /></AuthGate>
    </AuthProvider>
  );
}
