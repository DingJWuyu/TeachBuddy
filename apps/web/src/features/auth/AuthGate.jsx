import { useTranslation } from 'react-i18next';
import { useInternalAuth } from './AuthProvider.jsx';
import AuthSurface from './AuthSurface.jsx';
import RestoreCard, { BootCard } from './RestoreView.jsx';
import { COPY } from './presentation.js';
import AccountDeletion from './AccountDeletion.jsx';

/*
 * The gate owns the handoff: children render in place only for a confirmed
 * active identity. Boot, recovery and failure keep the account surface.
 */
export default function AuthGate({ children }) {
  useTranslation('auth');
  const auth = useInternalAuth();
  if (auth.status === 'deleting') return <AccountDeletion />;
  if (auth.status === 'active') return children;
  if (auth.status === 'booting') return <BootCard />;
  if (auth.status === 'recovering') {
    return <RestoreCard checking onRetry={auth.retry} onReturn={auth.returnFromRecovery} />;
  }
  if (auth.status === 'error') {
    const message = auth.errorKind === 'browser'
      ? COPY.browserBlocked
      : auth.errorKind === 'restore'
        ? COPY.restoreFailed
        : COPY.bootFailed;
    return <RestoreCard message={message} onRetry={auth.retry} onReturn={auth.returnFromRecovery} />;
  }
  return <AuthSurface />;
}
