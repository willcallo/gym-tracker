import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Nav from './components/Nav';
import DraftOwner from './components/DraftOwner';
import { getUser } from '@/lib/session';

const geist = localFont({
  src: './fonts/Geist-Variable.woff2',
  variable: '--font-geist',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Gym Tracker',
  description: 'Personal workout tracker',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Null on the login page. Pages still do their own check; this only labels local drafts.
  const user = await getUser();
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased">
        <DraftOwner userId={user?.id ?? ''} />
        <main className="mx-auto max-w-xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <Nav />
      </body>
    </html>
  );
}
