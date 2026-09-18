import { useEffect, useRef, useState } from 'react';
import { fetchJson, postJson, putJson } from '../utils/api.js';
import { useAppStore } from '../store/useAppStore.js';
import { localizeError, localizeText } from '../utils/labels.js';

export function useWorkspaceData() {
  const { authToken, setSession, setActiveModuleId } = useAppStore();
  const authTokenRef = useRef(authToken);
  const [serverModules, setServerModules] = useState([]);
  const [workspaceLayout, setWorkspaceLayout] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [loading, setLoading] = useState(Boolean(authToken));
  const layoutStateRef = useRef(workspaceLayout);
  const layoutSaveQueueRef = useRef(Promise.resolve());
  const latestLayoutRequestRef = useRef(0);

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  useEffect(() => {
    layoutStateRef.current = workspaceLayout;
  }, [workspaceLayout]);

  async function loadData() {
    if (!authToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [modules, me, layout] = await Promise.all([
        fetchJson('/modules'),
        fetchJson('/auth/me'),
        fetchJson('/workspace/layout')
      ]);

      if (authTokenRef.current !== authToken) return;
      setServerModules(modules.items);
      setWorkspaceLayout(layout);
      setSession({ token: authToken, user: me.user });
    } catch (loadError) {
      if (authTokenRef.current !== authToken) return;
      const message = loadError.message || 'Could not load workspace data.';
      setError(localizeError(message));
      if (message.toLowerCase().includes('auth')) {
        setSession({ token: '', user: null });
      }
    } finally {
      if (authTokenRef.current === authToken) setLoading(false);
    }
  }

  useEffect(() => {
    if (authToken) {
      loadData();
    } else {
      setServerModules([]);
      setWorkspaceLayout(null);
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(''), 2500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  async function updateWorkspaceLayout(nextLayout, successMessage = '工作台设置已保存。') {
    const previousLayout = layoutStateRef.current;
    const requestId = latestLayoutRequestRef.current + 1;
    latestLayoutRequestRef.current = requestId;
    layoutStateRef.current = nextLayout;
    setWorkspaceLayout(nextLayout);

    const request = layoutSaveQueueRef.current.then(() => putJson('/workspace/layout', nextLayout));
    layoutSaveQueueRef.current = request.catch(() => null);

    try {
      const savedLayout = await request;
      if (requestId !== latestLayoutRequestRef.current) return savedLayout;
      layoutStateRef.current = savedLayout;
      setWorkspaceLayout(savedLayout);
      setFlash(successMessage);
      setError('');
      return savedLayout;
    } catch (layoutError) {
      if (requestId !== latestLayoutRequestRef.current) return null;
      layoutStateRef.current = previousLayout;
      setWorkspaceLayout(previousLayout);
      setError(localizeError(layoutError.message || 'Something went wrong.'));
      return null;
    }
  }

  function toggleModuleVisibility(moduleId, isVisible) {
    if (!workspaceLayout) return Promise.resolve(null);
    const hiddenModuleIds = isVisible
      ? workspaceLayout.hiddenModuleIds.filter((hiddenId) => hiddenId !== moduleId)
      : [...workspaceLayout.hiddenModuleIds, moduleId];
    return updateWorkspaceLayout({
      ...workspaceLayout,
      hiddenModuleIds
    });
  }

  function setAuthenticatedSession(response, message) {
    setSession(response);
    setActiveModuleId('dashboard');
    setFlash(message + localizeText(response.user.name) + '。');
    setError('');
  }

  return {
    serverModules,
    workspaceLayout,
    error,
    flash,
    loading,
    loadData,
    toggleModuleVisibility,
    updateWorkspaceLayout,
    async login(email, password) {
      try {
        const response = await postJson('/auth/login', { email, password });
        setAuthenticatedSession(response, '欢迎回来，');
      } catch (loginError) {
        setError(localizeError(loginError.message || 'Login failed.'));
      }
    },
    async register(name, email, password, passwordConfirmation) {
      try {
        const response = await postJson('/auth/register', { name, email, password, passwordConfirmation });
        setAuthenticatedSession(response, '欢迎加入，');
        return true;
      } catch (registrationError) {
        setError(localizeError(registrationError.message || 'Registration failed.'));
        return false;
      }
    },
    async requestPasswordReset(email) {
      try {
        await postJson('/auth/password-reset/request', { email });
        setError('');
        return true;
      } catch (recoveryError) {
        setError(localizeError(recoveryError.message || 'Password recovery request failed.'));
        return false;
      }
    },
    async confirmPasswordReset({ email, code, password, passwordConfirmation }) {
      try {
        await postJson('/auth/password-reset/confirm', { email, code, password, passwordConfirmation });
        setError('');
        return true;
      } catch (resetError) {
        setError(localizeError(resetError.message || 'Password reset failed.'));
        return false;
      }
    }
  };
}
