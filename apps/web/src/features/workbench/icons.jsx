/** Line icons for the workbench shell, sized to the 36px navigation rows. */

const PATHS = {
  math: 'M3 14l3 3 4-13h7M12 9l5 6M17 9l-5 6',
  calendar: 'M4 5h12v12H4zM4 8h12M7 3v4M13 3v4M7 11h1M11 11h1M7 14h1',
  bell: 'M5 13h10l-1-2V8a4 4 0 0 0-8 0v3zM8 16h4',
  classes: 'M3 5h14v9H3zM6 17l2-3M14 17l-2-3M6 8h8M6 11h5',
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

export function Icon({ name, size = 17, className = '' }) {
  const path = PATHS[name] || PATHS.question;
  return (
    <svg
      className={`wb-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
