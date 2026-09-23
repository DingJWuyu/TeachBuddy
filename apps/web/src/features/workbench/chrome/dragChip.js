/*
 * Drag image for every surface in the shell.
 *
 * The browser's default drag image is a snapshot of the dragged element at full
 * size. For a 36px sidebar row, or for a notification wider than the trash it is
 * heading for, that snapshot lands on top of the drop target and hides the one
 * piece of feedback that matters: whether the trash has recognised the drag.
 *
 * The chip is therefore drawn by us and moved by us, rather than handed to
 * `setDragImage`. The native image cannot be positioned reliably: the operating
 * system's own cursor is drawn on top of it, and it covers whichever part of the
 * image it happens to sit over, so a disc that is centred on the pointer reads as
 * an off-centre disc with a black arrow inside it. A node we place ourselves is
 * centred on the pointer exactly, and the native image is suppressed with a
 * one-pixel transparent canvas so the two cannot appear at once.
 *
 * The chip is a 32px white disc with the dragged item's own icon in it, centred
 * on the pointer. The disc is small enough to leave the drop target visible and
 * it gives the drag one shape across the sidebar and the notification panel.
 */
const CHIP_SIZE = 32;
const GLYPH_SIZE = 20;
const GLYPH_STROKE = 1.8;

/* The outline set from icons.jsx, on a 24x24 grid and stroke-only, so one tint
 * colour stands in for both the ink and the accent. */
const CHIP_GLYPHS = {
  home: ['M4 10.5 12 4l8 6.5V20H4z', 'M9.5 20v-6h5v6'],
  circleHelp: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  settings: [
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z'
  ],
  newspaper: [
    'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V5',
    'M18 14h-8M15 18h-5M10 6h8v4h-8z'
  ],
  classes: ['M4 6.5h16v12H4z', 'M8 6.5v12M16 6.5v12M4 10.5h16'],
  calendar: ['M5.5 5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M7.5 3v4M16.5 3v4M3.5 9h17'],
  planner: ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5'],
  lessons: ['M4 5.5c3-1.6 5.6-1.6 8 0v14c-2.4-1.6-5-1.6-8 0z', 'M20 5.5c-3-1.6-5.6-1.6-8 0v14c2.4-1.6 5-1.6 8 0z'],
  students: [
    'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'M17 6.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z',
    'M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6',
    'M14 14c3-.5 5 .9 5.8 4'
  ],
  classwork: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 9l2 2 5-5M8 15h8'],
  grades: ['M5 19L19 5', 'M7 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M17 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  attendance: ['M5 4h14v16H5z', 'M8 8h8M8 12h4', 'M14 16l1.5 1.5L19 14'],
  standards: ['M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z'],
  search: ['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M16 16l4 4'],
  feedback: ['M22 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2z', 'M9.5 10h5M12 7.5v5'],
  bell: ['M10.3 21a2 2 0 0 0 3.4 0', 'M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3'],
  tutorial: [
    'M21.4 10.9a1 1 0 0 0 0-1.8L12.8 5.2a2 2 0 0 0-1.6 0L2.6 9.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0z',
    'M22 10v6',
    'M6 12.5V16a6 3 0 0 0 12 0v-3.5'
  ],
  shield: ['M12 3l7 3v5c0 4.6-2.4 7.8-7 10-4.6-2.2-7-5.4-7-10V6z', 'M9 12l2 2 4-5'],
  folder: ['M3.5 6.5h6l2 2h9v10h-17z', 'M3.5 9h17'],
  trash: ['M4 7h16', 'M9 3h6l1 4H8z', 'M7 7l1 14h8l1-14', 'M10 11v6M14 11v6'],
  language: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  inbox: ['M3.5 12h4l1.5 3h6l1.5-3h4', 'M5.5 5h13l2 7v7h-17v-7z']
};

const FALLBACK_GLYPHS = ['M5 5h14v14H5z', 'M9 9h6v6H9z'];
const SVG_NS = 'http://www.w3.org/2000/svg';

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
 * `icon` names a glyph from the shell's own outline set; an unknown name falls
 * back to a plain square so a drag always has something to show.
 */
export function createDragChip({ icon }) {
  const node = document.createElement('div');
  node.className = 'tb-drag-chip';
  node.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(GLYPH_SIZE));
  svg.setAttribute('height', String(GLYPH_SIZE));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(GLYPH_STROKE));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const definition of CHIP_GLYPHS[icon] || FALLBACK_GLYPHS) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', definition);
    svg.appendChild(path);
  }
  node.appendChild(svg);
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

  return {
    node,
    /** Suppresses the native image. Called with the `dragstart` event. */
    set(event) {
      event.dataTransfer.setDragImage(blankCanvas(), 0, 0);
      document.body.classList.add('is-dragging-item');
    },
    moveTo,
    remove() {
      node.remove();
      document.body.classList.remove('is-dragging-item');
    }
  };
}

/** The chip's own size, so callers and tests do not repeat it. */
export const DRAG_CHIP_SIZE = CHIP_SIZE;
