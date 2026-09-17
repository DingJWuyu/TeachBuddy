import { create } from 'zustand';

export const useAppStore = create((set) => ({
  activeModuleId: 'dashboard',
  authToken: typeof window !== 'undefined' ? window.localStorage.getItem('refatos-token') || '' : '',
  currentUser: null,
  setActiveModuleId: (activeModuleId) => set({ activeModuleId }),
  setSession: ({ token, user }) => {
    if (typeof window !== 'undefined') {
      if (token) window.localStorage.setItem('refatos-token', token);
      else window.localStorage.removeItem('refatos-token');
    }
    set({ authToken: token || '', currentUser: user || null });
  }
}));
