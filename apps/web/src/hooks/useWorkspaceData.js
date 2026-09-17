import { useEffect, useState } from 'react';
import { deleteJson, fetchJson, postForm, postJson, putJson } from '../utils/api.js';
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
  const [serverModules, setServerModules] = useState([]);
  const [moduleData, setModuleData] = useState(emptyData);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [loading, setLoading] = useState(Boolean(authToken));

  async function loadData() {
    if (!authToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [modules, templateItems, me, ...moduleResponses] = await Promise.all([
        fetchJson('/modules'),
        fetchJson('/templates'),
        fetchJson('/auth/me'),
        ...frontendModules.map((moduleItem) => fetchJson(moduleItem.data.endpoint))
      ]);

      setServerModules(modules.items);
      setModuleData(Object.fromEntries(
        frontendModules.map((moduleItem, index) => [moduleItem.id, moduleItem.data.selectItems(moduleResponses[index])])
      ));
      setTemplates(templateItems.items);
      setSession({ token: authToken, user: me.user });
    } catch (loadError) {
      const message = loadError.message || 'Could not load RefatOS data.';
      setError(localizeError(message));
      if (message.toLowerCase().includes('auth')) {
        setSession({ token: '', user: null });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authToken) {
      loadData();
    } else {
      setServerModules([]);
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

  function setAuthenticatedSession(response, message) {
    setSession(response);
    setFlash(`${message}${localizeText(response.user.name)}。`);
    setError('');
  }

  return {
    serverModules,
    moduleData,
    templates,
    error,
    flash,
    loading,
    loadData,
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
      } catch (registrationError) {
        setError(localizeError(registrationError.message || 'Registration failed.'));
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
