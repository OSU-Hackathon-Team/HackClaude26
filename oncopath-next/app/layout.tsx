import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "OncoPath — Metastatic Risk Nexus",
  description: "AI-powered anatomical risk visualization for cancer metastasis prediction",
};

import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`} style={{ fontFamily: 'var(--font-inter), Inter, -apple-system, sans-serif' }}>
        <ClerkProvider>
          <header className="absolute top-0 right-0 p-4 z-50 pointer-events-auto flex items-center justify-end gap-3 text-slate-100">
            <Show when="signed-out">
              <SignInButton forceRedirectUrl="/viewer">
                 <button className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md rounded-lg text-sm font-semibold transition-all border border-slate-700/50">Login</button>
              </SignInButton>
              <SignUpButton forceRedirectUrl="/viewer">
                 <button className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 backdrop-blur-md rounded-lg text-sm font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">Sign Up</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
