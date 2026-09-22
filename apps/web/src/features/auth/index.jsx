import { useContext } from 'react';
import AuthProvider, { PUBLIC_AUTH } from './AuthProvider.jsx';
import AuthGate from './AuthGate.jsx';
import './auth.css';

export { AuthProvider, AuthGate };

export function useAuth() {
  const value = useContext(PUBLIC_AUTH);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
