import { useEffect, useRef, useState } from 'react';
import { deleteJson, fetchJson, openAuthenticatedFile, postForm, postJson, putJson } from '../utils/api.js';
import { frontendModules, getFrontendModule } from '../features/modules/moduleRegistry.js';
import { useAppStore } from '../store/useAppStore.js';
import { localizeError, localizeText } from '../utils/labels.js';

const emptyData = Object.fromEntries(frontendModules.map((moduleItem) => [moduleItem.id, []]));

function getModuleDefinition(moduleId) {
  const moduleItem = getFrontendModule(moduleId);
  if (!moduleItem) {
    throw new Error(`Unknown teacher module: ${moduleId}`);
  }
  return moduleItem;
}

export function useWorkspaceData() {
  const { authToken, setSession, setActiveModuleId } = useAppStore();
  const authTokenRef = useRef(authToken);
  const [serverModules, setServerModules] = useState([]);
  const [workspaceLayout, setWorkspaceLayout] = useState(null);
  const [moduleData, setModuleData] = useState(emptyData);
  const [templates, setTemplates] = useState([]);
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
      const [modules, templateItems, me, layout, ...moduleResponses] = await Promise.all([
        fetchJson('/modules'),
        fetchJson('/templates'),
        fetchJson('/auth/me'),
        fetchJson('/workspace/layout'),
        ...frontendModules.map((moduleItem) => fetchJson(moduleItem.data.endpoint))
      ]);

      if (authTokenRef.current !== authToken) return;

      setServerModules(modules.items);
      setWorkspaceLayout(layout);
      setModuleData(Object.fromEntries(
        frontendModules.map((moduleItem, index) => [moduleItem.id, moduleItem.data.selectItems(moduleResponses[index])])
      ));
      setTemplates(templateItems.items);
      setSession({ token: authToken, user: me.user });
    } catch (loadError) {
      if (authTokenRef.current !== authToken) return;
      const message = loadError.message || 'Could not load RefatOS data.';
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
      setModuleData(emptyData);
      setTemplates([]);
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(''), 2500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  async function runAction(action, successMessage) {
    try {
      await action();
      await loadData();
      if (successMessage) {
        setFlash(successMessage);
      }
    } catch (actionError) {
      setError(localizeError(actionError.message || 'Something went wrong.'));
    }
  }

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
    setFlash(`${message}${localizeText(response.user.name)}。`);
    setError('');
  }

  return {
    serverModules,
    workspaceLayout,
    moduleData,
    templates,
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
    async confirmPasswordReset(email, code, password, passwordConfirmation) {
      try {
        await postJson('/auth/password-reset/confirm', { email, code, password, passwordConfirmation });
        setError('');
        return true;
      } catch (resetError) {
        setError(localizeError(resetError.message || 'Password reset failed.'));
        return false;
      }
    },
    createItem(moduleId, payload) {
      return runAction(
        () => postJson(getModuleDefinition(moduleId).data.endpoint, payload),
        getModuleDefinition(moduleId).messages?.create || '保存成功。'
      );
    },
    updateItem(moduleId, id, payload) {
      return runAction(() => putJson(`${getModuleDefinition(moduleId).data.endpoint}/${id}`, payload), '更新成功。');
    },
    removeItem(moduleId, id) {
      return runAction(() => deleteJson(`${getModuleDefinition(moduleId).data.endpoint}/${id}`), '删除成功。');
    },
    createTemplate(moduleId, name, payload) {
      return runAction(() => postJson('/templates', { moduleId, name, payload }), '模板已保存。');
    },
    removeTemplate(id) {
      return runAction(() => deleteJson(`/templates/${id}`), '模板已删除。');
    },
    openResource(id) {
      return runAction(
        () => openAuthenticatedFile(`/modules/resource-vault/${id}/file`),
        ''
      );
    },
    openExport(id, target) {
      return runAction(
        () => openAuthenticatedFile(`/modules/worksheet-designer/${id}/export/${target}`, {
          download: target !== 'preview',
          filename: `worksheet-${id}.${target}`
        }),
        ''
      );
    },
    runModuleAction(moduleId, actionName, input) {
      const moduleItem = getModuleDefinition(moduleId);
      const action = moduleItem.actions?.[actionName];
      if (!action) {
        return Promise.reject(new Error(`Action ${actionName} is not registered for ${moduleId}.`));
      }

      return runAction(
        () => action({
          ...input,
          endpoint: moduleItem.data.endpoint,
          postJson,
          postForm,
          setActiveModuleId
        }),
        moduleItem.messages?.[actionName]
      );
    }
  };
}
