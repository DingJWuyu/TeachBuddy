import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon } from '../../../components/icons.jsx';

/*
 * The native image, suppressed.
 *
 * `setDragImage` has to be called for the default snapshot to be replaced, but
 * anything it is given is drawn by the browser where the browser chooses. A
 * transparent canvas leaves nothing to draw, so the only thing the user sees is
 * the chip this module places.
 */
let blankImage = null;

function blankCanvas() {
  if (!blankImage) {
    blankImage = document.createElement('canvas');
    blankImage.width = 1;
    blankImage.height = 1;
  }
  return blankImage;
}

/**
 * Builds the drag chip for one dragged item and returns the handle that moves it.
 *
 * `icon` uses the shared application glyph set.
 */
export function createDragChip({ icon }) {
  const node = document.createElement('div');
  node.className = 'tb-drag-chip';
  node.setAttribute('aria-hidden', 'true');

  const root = createRoot(node);
  root.render(createElement(Icon, { name: icon, size: 20, strokeWidth: 1.75 }));
  /*
   * Appended inside the prototype root, not to `document.body`. Every style in
   * the stylesheet is scoped under `.tb-prototype`, so a chip parented to the
   * body matched no rule at all: it rendered as an unstyled block filling the
   * page, which is exactly what a disc centred on the pointer is not.
   */
  (document.querySelector('.tb-prototype') || document.body).appendChild(node);

  /* Position with left/top and centre with transform. Hide until the first pointer coordinate arrives. */
  let placed = false;
  function moveTo(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    if (!placed) {
      placed = true;
      node.classList.add('is-placed');
    }
  }

  let removed = false;
  return {
    node,
    /** Suppresses the native image. Called with the `dragstart` event. */
    set(event) {
      event.dataTransfer.setDragImage(blankCanvas(), 0, 0);
      document.body.classList.add('is-dragging-item');
    },
    moveTo,
    remove() {
      if (removed) return;
      removed = true;
      root.unmount();
      node.remove();
      document.body.classList.remove('is-dragging-item');
    }
  };
}
