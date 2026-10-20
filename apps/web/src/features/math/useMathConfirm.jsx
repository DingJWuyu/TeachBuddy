import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';
import { ModulePresence } from '../../components/interaction/ModuleMotion.jsx';
import { AppConfirmDialog } from '../../components/ui/confirm.jsx';

export function useMathConfirm() {
  const { t } = useTranslation('math');
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
  const dialog = <ModulePresence present={!!message}>{message && <AppConfirmDialog title={message.title ?? t("确认操作")} message={message.text} confirmLabel={message.confirmLabel ?? t("继续")} onConfirm={() => finish(true)} onCancel={() => finish(false)} />}</ModulePresence>;
  return [confirm, dialog];
}
