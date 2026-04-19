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
            <Show when="signed-out">
              <SignInButton forceRedirectUrl="/viewer" mode="modal">
                <button className="px-3 py-1.5 rounded-lg bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-zinc-300 text-xs font-semibold hover:text-zinc-100 hover:border-zinc-700 transition-all">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton forceRedirectUrl="/viewer" mode="modal">
                <button className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-all shadow-[0_0_12px_rgba(234,88,12,0.4)]">
                  Get Started
                </button>
              </SignUpButton>
            </Show>
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
