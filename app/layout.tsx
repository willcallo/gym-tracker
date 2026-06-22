import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Nav from './components/Nav';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gym Tracker',
  description: 'Personal workout tracker with AI coaching',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-gray-950 text-gray-100 antialiased">
        <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">{children}</main>
        <Nav />
      </body>
    </html>
  );
}
