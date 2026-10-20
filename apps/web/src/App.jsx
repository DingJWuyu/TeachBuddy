import { AuthProvider, AuthGate } from './features/auth/index.jsx';
import WorkbenchRoot from './features/workbench/WorkbenchRoot.jsx';
import { clearDeletedAccountDeviceData } from './accountDeviceData.js';
import { ConfirmHost } from './components/ui/confirm.jsx';

export default function App() {
  return (
    <AuthProvider onAccountDeleted={clearDeletedAccountDeviceData}>
      <AuthGate><WorkbenchRoot /></AuthGate>
      <ConfirmHost />
    </AuthProvider>
  );
}
