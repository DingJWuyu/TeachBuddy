import { h, Fragment } from '../shim.js';

/*
 * Line glyphs drawn in the spirit of SF Symbols: a 24 grid, one stroke weight,
 * rounded caps and corners, generous counters. The app's own icon renderer
 * (Icon2) looks names up here first, so every place that asks for "trash" or
 * "bell" gets the same drawing — the shell, the notifications and the modules.
 */
export function buildGlyphs() {
  const sidebarLeft = (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <path d="M9.5 4.5v15" />
      <path d="M5.6 8.2h1.5M5.6 10.9h1.5M5.6 13.6h1.5" />
    </>
  );
  const sidebarRight = (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <path d="M14.5 4.5v15" />
      <path d="M16.9 8.2h1.5M16.9 10.9h1.5M16.9 13.6h1.5" />
    </>
  );

  return {
    panelOpen: sidebarLeft,
    panelClose: sidebarLeft,
    sidebarLeft,
    sidebarRight,
    bell: (
      <>
        <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.6 1.7H4.9z" />
        <path d="M10 20.4a2.3 2.3 0 0 0 4 0" />
      </>
    ),
    feedback: (
      <>
        <path d="M6 5h12a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3h-6.2L7.5 20.6v-3.1H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" />
        <path d="M8 10h8M8 13h5" />
      </>
    ),
    tutorial: (
      <>
        <path d="M12 3.2a6 6 0 0 0-3.7 10.7c.7.6 1.2 1.4 1.2 2.3h5c0-.9.5-1.7 1.2-2.3A6 6 0 0 0 12 3.2Z" />
        <path d="M9.6 18.6h4.8M10.6 21h2.8" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.2 19 6v5.3c0 4.4-2.9 8-7 9.6-4.1-1.6-7-5.2-7-9.6V6z" />
        <path d="m9 12.1 2.1 2.1 4-4.4" />
      </>
    ),
    trash: (
      <>
        <path d="M4.5 6.6h15" />
        <path d="M9.4 6.6V5.1c0-.9.7-1.6 1.6-1.6h2c.9 0 1.6.7 1.6 1.6v1.5" />
        <path d="m6.4 6.6.8 12.1a2 2 0 0 0 2 1.8h5.6a2 2 0 0 0 2-1.8l.8-12.1" />
        <path d="M10.1 10.6v5.8M13.9 10.6v5.8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
      </>
    ),
    book: (
      <>
        <path d="M6.5 3.5h11.2c.7 0 1.3.6 1.3 1.3v13.4c0 .7-.6 1.3-1.3 1.3H6.5A2.5 2.5 0 0 1 4 17V6a2.5 2.5 0 0 1 2.5-2.5Z" />
        <path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H19" />
        <path d="M8.5 7.6h6M8.5 10.6h4" />
      </>
    ),
    graph: <path d="M3 12.8h3.2l3.1 7.2 5.2-16H21" />,
    /* narrowing a list: three lines, each shorter than the last */
    filter: <path d="M4.5 7h15M7.5 12h9M10.5 17h3" />,
    paperclip: <path d="m20 11.6-7.8 7.8a5.2 5.2 0 0 1-7.4-7.4l8.1-8.1a3.5 3.5 0 0 1 4.9 4.9l-8 8a1.75 1.75 0 0 1-2.5-2.5l7.3-7.3" />,
    /* the Math workshop's mark: a radical with x under it, everywhere the module appears */
    math: (
      <>
        <path d="M2.8 13.4h2.7l2.7 6.4 4.5-15.3H21.2" />
        <path d="m14.6 10.6 5 6.2M19.6 10.6l-5 6.2" />
      </>
    ),
    folder: (
      <>
        <path d="M3.5 7.5a2 2 0 0 1 2-2h4.2l2 2.2h6.8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
        <path d="M3.5 10.6h17" />
      </>
    ),
    // the same folder, its front flap tipped open (a folder you are inside)
    folderOpen: (
      <>
        <path d="M3.5 17.5V7.5a2 2 0 0 1 2-2h4.2l2 2.2h6.3a2 2 0 0 1 2 2v1" />
        <path d="M3.5 18.2 6 11.9a1.6 1.6 0 0 1 1.5-1h13a1 1 0 0 1 .94 1.35L19 18.7a2 2 0 0 1-1.88 1.3H5.4a1.9 1.9 0 0 1-1.9-1.8Z" />
      </>
    ),
    // a kind of file (PDF, slides, image…): a page with a folded corner
    fileType: (
      <>
        <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3.5V8h4.5" />
      </>
    ),
    plus: <path d="M12 5.5v13M5.5 12h13" />,
    minus: <path d="M5.5 12h13" />,
    close: <path d="m7 7 10 10M17 7 7 17" />,
    chevron: <path d="m7.5 10 4.5 4.5 4.5-4.5" />,
    /* the assistant's mark, wherever the assistant is offered */
    sparkles: (
      <>
        <path d="M11 3.8c.7 4.3 2.9 6.5 7.2 7.2-4.3.7-6.5 2.9-7.2 7.2-.7-4.3-2.9-6.5-7.2-7.2 4.3-.7 6.5-2.9 7.2-7.2Z" />
        <path d="M18.6 15.6c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z" />
      </>
    ),
    forward: <path d="m10 7 5 5-5 5" />,
    select: <path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" />,
    home: <path d="M4.5 10.6 12 4.4l7.5 6.2V19c0 .8-.7 1.5-1.5 1.5h-3.5v-6h-5v6H6c-.8 0-1.5-.7-1.5-1.5Z" />,
    language: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5M12 3.5C9.6 5.9 8.6 8.7 8.6 12s1 6.1 3.4 8.5" />
      </>
    ),
    pencil: (
      <>
        <path d="m15.6 4.6 3.8 3.8L8.7 19.1l-4.6.8.8-4.6z" />
        <path d="m13.6 6.6 3.8 3.8" />
      </>
    ),
    more: (
      <>
        <circle cx="6" cy="12" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="18" cy="12" r="1.2" />
      </>
    ),
    restore: (
      <>
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
        <path d="M4.5 4.5v3.8h3.8" />
      </>
    ),
    undo: (
      <>
        <path d="M9 14.5 4.5 10 9 5.5" />
        <path d="M4.5 10H14a5.5 5.5 0 0 1 0 11h-3" />
      </>
    ),
    redo: (
      <>
        <path d="M15 14.5 19.5 10 15 5.5" />
        <path d="M19.5 10H10a5.5 5.5 0 0 0 0 11h3" />
      </>
    ),
    play: <path d="M7.5 5.6v12.8a1 1 0 0 0 1.5.86l10.6-6.4a1 1 0 0 0 0-1.72L9 4.74a1 1 0 0 0-1.5.86z" />,
    layers: (
      <>
        <path d="m12 4 8.5 4.2L12 12.4 3.5 8.2z" />
        <path d="m3.5 12.2 8.5 4.2 8.5-4.2" />
        <path d="m3.5 16.1 8.5 4.2 8.5-4.2" />
      </>
    ),
    students: (
      <>
        <circle cx="9" cy="8.2" r="3.2" />
        <path d="M3.4 19.2c.6-3.2 2.8-5 5.6-5s5 1.8 5.6 5" />
        <path d="M15.6 5.4a3 3 0 0 1 0 5.6" />
        <path d="M17.2 14.4c1.9.5 3.1 2.1 3.4 4.8" />
      </>
    ),
    grip: (
      <>
        <circle cx="9.5" cy="7" r="1" />
        <circle cx="14.5" cy="7" r="1" />
        <circle cx="9.5" cy="12" r="1" />
        <circle cx="14.5" cy="12" r="1" />
        <circle cx="9.5" cy="17" r="1" />
        <circle cx="14.5" cy="17" r="1" />
      </>
    ),
  };
}
