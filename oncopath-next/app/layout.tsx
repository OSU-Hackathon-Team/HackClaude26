import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], weight: ['400','500','600','700'] });

export const metadata: Metadata = {
  title: 'OncoPath — Metastatic Risk Nexus',
  description: 'AI-powered anatomical metastatic risk visualization',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} h-full overflow-hidden bg-zinc-950 antialiased`}>
        <ClerkProvider>
          {/* Minimal fixed auth — top-right glass pill */}
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>

          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
