import { useEffect } from 'react';

// Math dialogs confirm with Enter; Escape and focus trapping stay in ModuleMotion.
export function useMathDialogKeys(ref) {
  useEffect(() => {
    const root = ref.current;
    const dialog = root?.matches('[role="dialog"]') ? root : root?.querySelector('[role="dialog"]');
    if (!dialog) return;
    const confirm = () => dialog.querySelector('[name="dialog-confirm"]:not(:disabled)');
    const field = dialog.querySelector('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)');
    dialog.tabIndex = -1;
    (field ?? confirm() ?? dialog).focus();
    const keydown = event => {
      if (event.key !== 'Enter') return;
      const top = [...document.querySelectorAll('[role="dialog"]')].filter(node => node.getClientRects().length && !node.closest('[inert]')).at(-1);
      if (top !== dialog) return;
      const editingText = event.target.closest?.('input, textarea, [contenteditable="true"]');
      const multiline = event.target.closest?.('textarea, [contenteditable="true"]');
      const composing = event.isComposing || event.keyCode === 229;
      if (composing && editingText) return;
      if (multiline && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat) return;
      // Returning alone lets a focused button activate through the browser's default click.
      event.preventDefault();
      event.stopPropagation();
      if (composing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      confirm()?.click();
    };
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, [ref]);
}
