import { useTranslation } from 'react-i18next';

import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { useAuxiliaryTools, useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';

export function MathTools({ children, sceneKey = 'current' }) {
  const { t } = useTranslation('math');
  const shell = useWorkbenchShell();
  const [scene, patch] = useScene(shell.accountKey, `math-tools:${sceneKey}`, { top: 0, listTop: 0, expanded: {} });
  const [host, setHost] = useState(null);
  const restored = useRef(null);
  useAuxiliaryTools([{ id: 'math-tools', label: t("制作工具"), render: () => <div className="math-tools-panel wb-module" ref={setHost}
    onScrollCapture={event => {
      if (event.target === event.currentTarget) patch({ top: event.target.scrollTop });
      else if (event.target.tagName === 'NAV') patch({ listTop: event.target.scrollTop });
    }} onToggleCapture={event => {
      if (event.target.tagName !== 'DETAILS') return;
      const title = event.target.querySelector(':scope > summary')?.textContent;
      if (title) patch(current => ({ expanded: { ...current.expanded, [title]: event.target.open } }));
    }} /> }]);
  useLayoutEffect(() => {
    if (!host || restored.current?.host === host && restored.current?.key === sceneKey) return;
    for (const details of host.querySelectorAll('details')) {
      const title = details.querySelector(':scope > summary')?.textContent;
      if (Object.hasOwn(scene.expanded, title)) details.open = scene.expanded[title];
    }
    host.scrollTop = scene.top;
    const list = host.querySelector('nav'); if (list) list.scrollTop = scene.listTop;
    restored.current = { host, key: sceneKey };
  }, [host, children, sceneKey]);
  return host ? createPortal(children, host) : null;
}
