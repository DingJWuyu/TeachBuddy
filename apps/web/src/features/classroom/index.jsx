import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { createClassroomApi } from './api.js';
import { ClassroomWorkspace } from './ClassroomPage.jsx';
import './classroom.css';

export default function ClassroomPage({ transport }) {
  const shell = useWorkbenchShell();
  // Remounting per account and identity generation aborts the previous identity's in-flight requests.
  return <ClassroomSession key={`${shell.accountKey}:${shell.generation}`} shell={shell} transport={transport || shell.transport} />;
}

function ClassroomSession({ shell, transport }) {
  const controller = useRef(null);
  useLayoutEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const api = useMemo(() => createClassroomApi({ accountKey: shell.accountKey, transport, getSignal: () => controller.current.signal, onIdentityLost: shell.notifyIdentityLost }), [shell.accountKey, transport]);
  return <ClassroomWorkspace api={api} shell={shell} transport={transport || shell.transport} />;
}
