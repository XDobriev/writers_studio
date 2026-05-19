type IconName =
  | 'bold' | 'italic' | 'underline' | 'strike' | 'h1' | 'h2' | 'h3'
  | 'list' | 'olist' | 'align' | 'aligncenter' | 'alignright' | 'alignjustify'
  | 'quote' | 'link' | 'unlink' | 'highlight' | 'hr' | 'code' | 'codeblock'
  | 'undo' | 'redo' | 'sup' | 'sub' | 'tasklist' | 'clear' | 'indent' | 'outdent'
  | 'color' | 'sparkles' | 'focus' | 'split' | 'speak' | 'download'
  | 'save' | 'book' | 'layout' | 'grid' | 'tree' | 'map' | 'clock'
  | 'user' | 'note' | 'plus' | 'chev' | 'chevd' | 'track' | 'history'
  | 'settings' | 'timer' | 'sound' | 'search' | 'eye' | 'panel'
  | 'dot' | 'pin' | 'char' | 'arrows' | 'moremenu' | 'feather' | 'pencil' | 'trash' | 'drag'
  | 'sun' | 'moon' | 'camera';

interface IconProps {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, JSX.Element> = {
  bold: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />,
  italic: <><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></>,
  underline: <><path d="M6 3v8a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></>,
  strike: <><path d="M16 4H9a3 3 0 0 0 0 6h3"/><path d="M14 14h.5a3 3 0 0 1 0 6H8"/><line x1="4" y1="12" x2="20" y2="12"/></>,
  h1: <><path d="M4 4v16M12 4v16M4 12h8"/><path d="M17 8l3-1v13"/></>,
  h2: <><path d="M4 4v16M12 4v16M4 12h8"/><path d="M16 8a3 3 0 0 1 6 0c0 2-3 3-6 6h6"/></>,
  h3: <><path d="M4 4v16M12 4v16M4 12h8"/><path d="M16 8a3 3 0 1 1 3 4 3 3 0 1 1-3 4"/></>,
  list: <><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
  olist: <><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 6h2M5 6V3M4 18h2a1 1 0 0 0 0-2H4a1 1 0 0 1 0-2h2"/></>,
  align: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></>,
  aligncenter: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>,
  quote: <path d="M7 7h4v6H7zM7 13c0 2 1 3 3 3M13 7h4v6h-4zM13 13c0 2 1 3 3 3" />,
  link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
  color: <><circle cx="12" cy="12" r="9"/><path d="M12 3a4 4 0 0 0 0 8c2 0 3 1 3 2s-1 2-3 2-3 1-3 2 0 2 3 2"/></>,
  sparkles: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/></>,
  focus: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></>,
  split: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="12" y1="4" x2="12" y2="20"/></>,
  speak: <><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></>,
  download: <><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
  save: <><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4"/></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="9" y1="4" x2="9" y2="20"/></>,
  grid: <><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></>,
  tree: <><path d="M5 4v6M5 14v6M5 10h7M5 17h7M12 4h7v4h-7zM12 12h7v4h-7zM12 19h7v3h-7z"/></>,
  map: <><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><line x1="9" y1="4" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="20"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  note: <><path d="M5 4h11l3 3v13H5z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  chev: <polyline points="9 6 15 12 9 18" />,
  chevd: <polyline points="6 9 12 15 18 9" />,
  track: <><path d="M4 7h10M4 12h16M4 17h13"/><path d="M16 5l4 4-4 4"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 8v5l3 2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.5-2.4.8a7 7 0 0 0-1.9-1.1L14 3h-4l-.6 2.6a7 7 0 0 0-1.9 1.1l-2.4-.8-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .7.1 1.1l-2 1.5 2 3.5 2.4-.8a7 7 0 0 0 1.9 1.1L10 21h4l.6-2.6a7 7 0 0 0 1.9-1.1l2.4.8 2-3.5-2-1.5c.1-.4.1-.7.1-1.1z"/></>,
  timer: <><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 9v4l2 2"/></>,
  sound: <><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="15" y1="4" x2="15" y2="20"/></>,
  dot: <circle cx="12" cy="12" r="2" />,
  pin: <><path d="M12 17v5"/><path d="M9 5h6l-1 6 3 2H7l3-2z"/></>,
  char: <><circle cx="12" cy="9" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><circle cx="12" cy="9" r="3.5"/></>,
  arrows: <polyline points="15 6 9 12 15 18" />,
  moremenu: <><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></>,
  feather: <><path d="M21 4c0 7-7 14-14 14H4l4-4M5 17l7-7M14 7l3 3"/></>,
  alignright: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></>,
  alignjustify: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
  unlink: <><path d="M17 7l-4 4M10 16l-2 2a4 4 0 0 1-5.7-5.7L5 9"/><path d="M14 8l3-3a4 4 0 0 1 5.7 5.7L20 13"/><line x1="3" y1="3" x2="21" y2="21"/></>,
  highlight: <><path d="M14 4l6 6-9 9-4 1 1-4z"/><line x1="3" y1="21" x2="21" y2="21"/></>,
  hr: <><line x1="3" y1="12" x2="21" y2="12"/><circle cx="6" cy="6" r="0.5"/><circle cx="18" cy="18" r="0.5"/></>,
  code: <><polyline points="9 8 4 12 9 16"/><polyline points="15 8 20 12 15 16"/></>,
  codeblock: <><rect x="3" y="4" width="18" height="16" rx="2"/><polyline points="10 9 7 12 10 15"/><polyline points="14 9 17 12 14 15"/></>,
  undo: <><path d="M3 12a7 7 0 1 1 7 7H7"/><polyline points="3 7 3 12 8 12"/></>,
  redo: <><path d="M21 12a7 7 0 1 0-7 7h3"/><polyline points="21 7 21 12 16 12"/></>,
  sup: <><path d="M5 7l8 10M13 7l-8 10"/><path d="M17 4h2a1.5 1.5 0 0 1 0 3l-2 2h3"/></>,
  sub: <><path d="M5 7l8 10M13 7l-8 10"/><path d="M17 16h2a1.5 1.5 0 0 1 0 3l-2 2h3"/></>,
  tasklist: <><rect x="3" y="4" width="6" height="6" rx="1"/><polyline points="4.5 7 6 8.5 8.5 5.5"/><rect x="3" y="14" width="6" height="6" rx="1"/><line x1="12" y1="7" x2="20" y2="7"/><line x1="12" y1="17" x2="20" y2="17"/></>,
  clear: <><path d="M16 4l4 4-9 9H6l-2-2z"/><line x1="13" y1="7" x2="17" y2="11"/><line x1="3" y1="21" x2="21" y2="21"/></>,
  indent: <><line x1="11" y1="6" x2="20" y2="6"/><line x1="11" y1="12" x2="20" y2="12"/><line x1="3" y1="18" x2="20" y2="18"/><polyline points="3 8 7 12 3 16"/></>,
  outdent: <><line x1="11" y1="6" x2="20" y2="6"/><line x1="11" y1="12" x2="20" y2="12"/><line x1="3" y1="18" x2="20" y2="18"/><polyline points="7 8 3 12 7 16"/></>,
  pencil: <><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></>,
  drag: <><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
};

export function Icon({ name, size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
