"use client";

/** SF Symbols uslubidagi maxsus chizilgan ikonkalar to'plami. */
const paths: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2" />
      <rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2" />
      <rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2" />
      <rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3 20l1-5.4A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M12 7.5l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1z" fill="currentColor" stroke="none" />
    </>
  ),
  crm: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.9-4.8 5.5-4.8s4.9 1.6 5.5 4.8" />
      <circle cx="17.2" cy="9" r="2.4" />
      <path d="M16 14.9c2.2.3 3.9 1.7 4.4 4.2" />
    </>
  ),
  sklad: (
    <>
      <path d="M21 8l-9-4.5L3 8v8.5l9 4.5 9-4.5V8z" />
      <path d="M3 8l9 4.5L21 8" />
      <path d="M12 12.5V21" />
    </>
  ),
  katalog: (
    <>
      <path d="M12 21v-7" />
      <path d="M8 3.5c-.3 4.4.9 7.5 4 7.5s4.3-3.1 4-7.5c-1.5 1.2-2.6 1.2-4 0-1.4 1.2-2.5 1.2-4 0z" />
      <path d="M12 16.5c-3 .2-5.2-1.6-5.6-4.3 2.9.1 4.9 1.5 5.6 4.3z" />
      <path d="M12 16.5c3 .2 5.2-1.6 5.6-4.3-2.9.1-4.9 1.5-5.6 4.3z" />
    </>
  ),
  postlar: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <path d="M20.5 14.5L16 10 5 21" />
    </>
  ),
  sozlamalar: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" />
    </>
  ),
  bell: (
    <>
      <path d="M18.4 16H5.6c1.3-1.3 2-2.6 2-5.4a4.4 4.4 0 1 1 8.8 0c0 2.8.7 4.1 2 5.4z" />
      <path d="M10.4 19.2a1.8 1.8 0 0 0 3.2 0" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2.1-.9 2.1-1.9 0-.9-.6-1.4-.6-2.3 0-1.1.9-1.9 2.1-1.9h1.6A3.8 3.8 0 0 0 21 11.1C21 6.6 16.9 3 12 3z" />
      <circle cx="7.6" cy="10.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="17.2" cy="9.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  menu: (
    <>
      <rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3.5" />
      <path d="M9.6 4.5v15" />
      <path d="M5.6 8h1.6M5.6 11h1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.3" />
      <path d="M20.3 20.3l-4.1-4.1" />
    </>
  ),
  send: <path d="M4.5 12L20 5l-6.2 15-2.2-6.3L4.5 12z" />,
  logo: (
    <g fill="currentColor" stroke="none" transform="translate(12,12)">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} rx="3" ry="5.4" cy="-5.3" transform={`rotate(${a})`} />
      ))}
      <circle r="2.1" opacity=".5" />
    </g>
  ),
};

export function Icon({ name, size = 17 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="block shrink-0"
    >
      {paths[name]}
    </svg>
  );
}
