/** Íconos de línea propios (del prototipo). Son constantes del código, no contenido de usuarios. */
const PATHS = {
  knock:
    '<path d="M7 11V6a2 2 0 014 0v4M11 9V5a2 2 0 014 0v5M15 10V7a2 2 0 014 0v6a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2-4a2 2 0 013-2l1 2"/>',
  note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  teams: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0012 0M12 17v4"/>',
  hi: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  moon: '<path d="M20 14A8 8 0 1110 4a6 6 0 0010 10z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  elevator:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9.5 9.5L12 7l2.5 2.5M9.5 14.5L12 17l2.5-2.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  layers: '<path d="M12 3l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16.5l8 4 8-4"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  minus: '<path d="M6 12h12"/>',
  rotL: '<path d="M4 12a8 8 0 108-8H8"/><path d="M10 1L7 4l3 3"/>',
  rotR: '<path d="M20 12a8 8 0 11-8-8h4"/><path d="M14 1l3 3-3 3"/>',
  door: '<path d="M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M3 21h18"/><circle cx="14.5" cy="12" r=".8"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
