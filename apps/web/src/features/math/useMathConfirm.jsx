import { useEffect, useRef, useState } from 'react';
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { ConfirmDialog } from '../workbench/ModuleOverlays.jsx';

export function useMathConfirm() {
  const [message, setMessage] = useState(null);
  const resolveRef = useRef(null);
  useEffect(() => () => resolveRef.current?.(false), []);
  const finish = value => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setMessage(null);
  };
  const confirm = (message, options = {}) => new Promise(resolve => {
    resolveRef.current?.(false);
    resolveRef.current = resolve;
    setMessage({ text: message, ...options });
  });
  const dialog = <ModulePresence present={!!message}>{message && <ConfirmDialog title={message.title ?? '确认操作'} message={message.text} confirmLabel={message.confirmLabel ?? '继续'} onConfirm={() => finish(true)} onCancel={() => finish(false)} />}</ModulePresence>;
  return [confirm, dialog];
}
