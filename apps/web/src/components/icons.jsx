const LEGACY_PATHS = {
  history: 'M4 6a7 7 0 1 1-1 7M3 3v4h4M10 6v4l3 2',
  math: 'M3 14l3 3 4-13h7M12 9l5 6M17 9l-5 6',
  calendar: 'M4 5h12v12H4zM4 8h12M7 3v4M13 3v4M7 11h1M11 11h1M7 14h1',
  bell: 'M5 13h10l-1-2V8a4 4 0 0 0-8 0v3zM8 16h4',
  folder: 'M3 6h5l2 2h7v8H3zM3 6V4h5l2 2h7v2',
  home: 'M4 10.5 10 5l6 5.5V16a1 1 0 0 1-1 1h-3v-4H8v4H5a1 1 0 0 1-1-1z',
  bank: 'M4 8.5 10 5l6 3.5v1H4zM5.5 10.5V15M9 10.5V15M11 10.5V15M14.5 10.5V15M4 16h12',
  prep: 'M5 4h7l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM11.5 4v3.5H15M7 11h6M7 13.5h4',
  settings: 'M10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM10 3.6l.7 1.5 1.6-.4.9 1.4-1 1.3.9 1.6-1.5.8-.2 1.7-1.7.2-.5-1.6-1.7-.3-.3-1.7 1.4-.9-.6-1.6 1.6-.6z',
  sparkle: 'M10 3.5l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  menu: 'M3.5 6h13M3.5 10h13M3.5 14h13',
  close: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5 17 17',
  plus: 'M10 4.5v11M4.5 10h11',
  check: 'M4.5 10.5l3.5 3.5 7.5-8',
  trash: 'M4.5 6.5h11M8 6.5V5h4v1.5M6 6.5 6.7 16h6.6l.7-9.5M8.5 9v4.5M11.5 9v4.5',
  more: 'M5.5 10h.01M10 10h.01M14.5 10h.01',
  back: 'M16 10H4.5M9 5.5 4.5 10 9 14.5',
  chevron: 'M8 5.5 12.5 10 8 14.5',
  star: 'M10 4l1.9 3.9 4.3.6-3.1 3 .8 4.2-3.9-2-3.9 2 .8-4.2-3.1-3 4.3-.6z',
  question: 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8.4 8.2A1.7 1.7 0 0 1 11.7 9c0 1.2-1.7 1.4-1.7 2.6M10 14h.01',
  copy: 'M7.5 7.5V5.2a1 1 0 0 1 1-1h6.3a1 1 0 0 1 1 1v6.3a1 1 0 0 1-1 1H12.5M5.2 7.5h6.3a1 1 0 0 1 1 1v6.3a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z'
};

/* Shared outline icons on a 24x24 grid, with a 2-unit stroke. */
const ICON_PATHS = {
  // MiniCalendar's original calendar grid, distinct from the four-tile view.
  calendarGrid: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18M7 15h.01M12 15h.01M17 15h.01M7 18h.01M12 18h.01M17 18h.01" /></>,
  // Agent glyphs retain the fixed prototype geometry.
  chat: <path d="M20.5 11.6a8.1 8.1 0 0 1-11.8 7.2L3.8 20l1.3-4.4A8.1 8.1 0 1 1 20.5 11.6Z" />,
  spark: <path d="M12 3.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5Z" />,
  stop: <path d="M8 8h8v8H8z" />,
  chevronRight: <path d="m10 7.5 4.5 4.5-4.5 4.5" />,
  alert: <path d="M12 8.5v4.5M12 16.4h.01M10.3 4 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z" />,
  retry: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.8h3.8" />,
  compose: <path d="M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12M17.8 3.8l2.4 2.4-7.7 7.7-3.1.7.7-3.1 7.7-7.7Z" />,
  pin: <path d="M9 4.5h6M10 4.5v5.2l-3 3.3h10l-3-3.3V4.5M12 13v6.5" />,
  at: <path d="M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm0 0v1.3a2.7 2.7 0 0 0 5.2 1A8.6 8.6 0 1 0 17 19" />,
  open: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />,
  quote: <path d="M5 11.5h4.5V17H5zM5 11.5C5 8.5 6.5 6.6 9 6M14.5 11.5H19V17h-4.5zM14.5 11.5c0-3 1.5-4.9 4-5.5" />,
  sun: <path d="M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1" />,
  move: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />,
  clock: <path d="M12 20.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17ZM12 7.5V12l3 2" />,
  repeat: <path d="M4.5 11V9.5a3 3 0 0 1 3-3h11M15.5 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3h-11M8.5 20.5l-3-3 3-3" />,
  assistant: <><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h6"/></>,
  graph: <><path d="M4 3v17h17M6 16c4 0 4-10 8-10s3 7 6 7" /></>,
  arrowLeft: <path d="m14 6-6 6 6 6" />,
  arrowRight: <path d="m10 6 6 6-6 6" />,
  arrowUp: <path d="M12 20V4m-6 6 6-6 6 6" />,
  arrowDown: <path d="M12 4v16m-6-6 6 6 6-6" />,
  expand: <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6m0 6 7-7" />,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.1M4 12h.1M4 18h.1" />,
  file: <><path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6" /></>,
  upload: <path d="M4 15v5h16v-5M12 16V4m-5 5 5-5 5 5" />,
  link: <><path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-5-5l4-4a4 4 0 0 1 6 0m0 8a4 4 0 0 0 6 0l4-4a4 4 0 0 0-5-5l-1 1" /></>,
  tag: <><path d="M3 4h8l10 10-7 7L3 10z" /><circle cx="7" cy="8" r="1" /></>,
  home: <><path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M9.5 20v-6h5v6"/></>,
  circleHelp: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></>,
  settings: <><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>,
  newspaper: <><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V5"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9h17"/></>,
  planner: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  book: <><path d="M4 5.5c3-1.6 5.6-1.6 8 0v14c-2.4-1.6-5-1.6-8 0z"/><path d="M20 5.5c-3-1.6-5.6-1.6-8 0v14c2.4-1.6 5-1.6 8 0z"/></>,
  students: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M14 14c3-.5 5 .9 5.8 4"/></>,
  classwork: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l2 2 5-5M8 15h8"/></>,
  grades: <><path d="M5 19L19 5M7 6h.01M17 18h.01"/><circle cx="7" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/></>,
  attendance: <><path d="M5 4h14v16H5zM8 8h8M8 12h4"/><path d="M14 16l1.5 1.5L19 14"/></>,
  standards: <><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></>,
  // Message-square-plus marks feedback.
  feedback: <><path d="M22 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2z"/><path d="M9.5 10h5M12 7.5v5"/></>,
  bell: <><path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/></>,
  // Graduation cap marks tutorial progress.
  tutorial: <><path d="M21.4 10.9a1 1 0 0 0 0-1.8L12.8 5.2a2 2 0 0 0-1.6 0L2.6 9.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></>,
  shield: <><path d="M12 3l7 3v5c0 4.6-2.4 7.8-7 10-4.6-2.2-7-5.4-7-10V6z"/><path d="M9 12l2 2 4-5"/></>,
  shieldPlain: <path d="M12 3l7 3v5c0 4.6-2.4 7.8-7 10-4.6-2.2-7-5.4-7-10V6z"/>,
  language: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  check: <path d="M20 6L9 17l-5-5"/>,
  trash: <><path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  chevron: <path d="M8 10l4 4 4-4"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="M6 6l12 12M18 6L6 18"/>,
  panelClose: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M7 9l-2 3 2 3"/></>,
  panelOpen: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M5 9l2 3-2 3"/></>,
  folder: <><path d="M3.5 6.5h6l2 2h9v10h-17z"/><path d="M3.5 9h17"/></>,
  // Geometry follows the Lucide grid so these fill the 24x24 box like the rest
  // of the set; hand-fitted paths sat visibly small beside them.
  select: <><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></>,
  pencil: <><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></>,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>,
  sparkles: <><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></>,
  more: <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>,
  inbox: <><path d="M3.5 12h4l1.5 3h6l1.5-3h4"/><path d="M5.5 5h13l2 7v7h-17v-7z"/></>
};



/*
 * Line glyphs drawn in the spirit of SF Symbols: a 24 grid, one stroke weight,
 * rounded caps and corners, generous counters. The app's own icon renderer
 * (Icon2) looks names up here first, so every place that asks for "trash" or
 * "bell" gets the same drawing - the shell, the notifications and the modules.
 */
function buildGlyphs() {
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

const PROTOTYPE_GLYPHS = buildGlyphs();
const GLYPHS = { ...Object.fromEntries(Object.entries(LEGACY_PATHS).map(([name, path]) => [name, <g key={name} transform="scale(1.2)"><path d={path} /></g>])), ...ICON_PATHS, ...PROTOTYPE_GLYPHS };

export function Icon({ name, size = 20, strokeWidth = 2, className = '' }) {
  return (
    <svg
      className={`tb-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={PROTOTYPE_GLYPHS[name] ? Math.min(strokeWidth, 1.75) : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  );
}

export { Icon as Icon2 };
