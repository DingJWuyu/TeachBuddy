/*
 * Shared icon set for the workbench prototype.
 *
 * Paths are Lucide equivalents on a 24x24 grid, drawn as outlines so they match
 * the reference's line-icon grammar. The stroke width is Lucide's default 2:
 * inside a 24-unit viewBox rendered at 20px that lands as 1.67 device px, which
 * is what the reference renders. An earlier 1.7 was measurably too light, giving
 * 2px of ink where the reference gives 3px.
 */
export const ICON_PATHS = {
  home: <><path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M9.5 20v-6h5v6"/></>,
  circleHelp: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></>,
  settings: <><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>,
  newspaper: <><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V5"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></>,
  classes: <><path d="M4 6.5h16v12H4z"/><path d="M8 6.5v12M16 6.5v12M4 10.5h16"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9h17"/></>,
  planner: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  lessons: <><path d="M4 5.5c3-1.6 5.6-1.6 8 0v14c-2.4-1.6-5-1.6-8 0z"/><path d="M20 5.5c-3-1.6-5.6-1.6-8 0v14c2.4-1.6 5-1.6 8 0z"/></>,
  students: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M14 14c3-.5 5 .9 5.8 4"/></>,
  classwork: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l2 2 5-5M8 15h8"/></>,
  grades: <><path d="M5 19L19 5M7 6h.01M17 18h.01"/><circle cx="7" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/></>,
  attendance: <><path d="M5 4h14v16H5zM8 8h8M8 12h4"/><path d="M14 16l1.5 1.5L19 14"/></>,
  standards: <><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></>,
  // Reference top bar uses message-square-plus for the feedback entry.
  feedback: <><path d="M22 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2z"/><path d="M9.5 10h5M12 7.5v5"/></>,
  bell: <><path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/></>,
  // Graduation cap: the reference's tutorial-progress entry.
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
  inbox: <><path d="M3.5 12h4l1.5 3h6l1.5-3h4"/><path d="M5.5 5h13l2 7v7h-17v-7z"/></>
};

export function Icon({ name, size = 20, strokeWidth = 2 }) {
  return (
    <svg
      className="tb-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
