'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const icon = (children: React.ReactNode) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const links = [
  {
    href: '/',
    label: 'Home',
    match: (p: string) => p === '/' || p.startsWith('/log'),
    icon: icon(
      <>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </>
    ),
  },
  {
    href: '/exercises',
    label: 'Exercises',
    match: (p: string) => p.startsWith('/exercises'),
    icon: icon(
      <>
        <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
      </>
    ),
  },
  {
    href: '/history',
    label: 'History',
    match: (p: string) => p.startsWith('/history'),
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    match: (p: string) => p.startsWith('/settings'),
    icon: icon(
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
  },
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl">
        {links.map((link) => {
          const active = link.match(pathname);
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? 'text-brand-ink' : 'text-gray-600'
                }`}
              >
                {active && <span className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-brand" />}
                {link.icon}
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
