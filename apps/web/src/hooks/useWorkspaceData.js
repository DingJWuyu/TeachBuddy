import { useEffect, useMemo, useState } from 'react';
import { deleteJson, fetchJson, postForm, postJson, putJson } from '../utils/api.js';
import { useAppStore } from '../store/useAppStore.js';
import { localizeError, localizeText } from '../utils/labels.js';

const emptyData = {
  'schedule-organizer': [],
  'reminder-center': [],
  'lesson-planner': [],
  'worksheet-designer': [],
  'resource-vault': []
};

const moduleEndpoints = {
  'schedule-organizer': '/modules/schedule-organizer',
  'reminder-center': '/modules/reminder-center',
  'lesson-planner': '/modules/lesson-planner',
  'worksheet-designer': '/modules/worksheet-designer',
  'resource-vault': '/modules/resource-vault'
};

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
      const [modules, schedule, reminders, lessons, worksheets, resources, templateItems, me] = await Promise.all([
        fetchJson('/modules'),
        fetchJson('/modules/schedule-organizer'),
        fetchJson('/modules/reminder-center'),
        fetchJson('/modules/lesson-planner'),
        fetchJson('/modules/worksheet-designer'),
        fetchJson('/modules/resource-vault'),
        fetchJson('/templates'),
        fetchJson('/auth/me')
      ]);

      setServerModules(modules.items);
      setModuleData({
        'schedule-organizer': schedule.items,
        'reminder-center': reminders.items,
        'lesson-planner': lessons.items,
        'worksheet-designer': worksheets.items,
        'resource-vault': resources.items
      });
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

  const summary = useMemo(() => ({
    scheduleCount: moduleData['schedule-organizer'].length,
    reminderCount: moduleData['reminder-center'].filter((item) => item.status !== 'done').length,
    lessonCount: moduleData['lesson-planner'].length,
    worksheetCount: moduleData['worksheet-designer'].length,
    resourceCount: moduleData['resource-vault'].length,
    templateCount: templates.length
  }), [moduleData, templates]);

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
    summary,
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
        () => postJson(moduleEndpoints[moduleId], payload),
        moduleId === 'lesson-planner' ? '课程已保存，同时已创建自动提醒。' : '保存成功。'
      );
    },
    updateItem(moduleId, id, payload) {
      return runAction(() => putJson(`${moduleEndpoints[moduleId]}/${id}`, payload), '更新成功。');
    },
    removeItem(moduleId, id) {
      return runAction(() => deleteJson(`${moduleEndpoints[moduleId]}/${id}`), '删除成功。');
    },
    createTemplate(moduleId, name, payload) {
      return runAction(() => postJson('/templates', { moduleId, name, payload }), '模板已保存。');
    },
    removeTemplate(id) {
      return runAction(() => deleteJson(`/templates/${id}`), '模板已删除。');
    },
    completeRecurring(id) {
      return runAction(() => postJson(`/modules/reminder-center/${id}/complete`, {}), '提醒已完成。下一次重复提醒会在适用时自动安排。');
    },
    generateWorksheetFromLesson(id) {
      return runAction(async () => {
        await postJson(`/modules/lesson-planner/${id}/generate-worksheet-draft`, {});
        setActiveModuleId('worksheet-designer');
      }, '已根据课程计划创建练习单草稿。');
    },
    uploadResource(formData) {
      return runAction(() => postForm('/modules/resource-vault/upload', formData), '资源已上传。');
    }
  };
}
