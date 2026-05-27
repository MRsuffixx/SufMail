import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";

import { TRPCReactProvider } from "~/trpc/react";
import { config } from "~/config";

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <p className="text-sm text-white/60">Loading...</p>
      </div>
    </div>
  );
}

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-xl font-semibold text-red-400">Something went wrong</p>
        <p className="text-sm text-white/60">Please refresh the page or try again later.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-full bg-white/10 px-6 py-2 text-sm font-semibold transition hover:bg-white/20"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: config.app.name,
  description: config.app.tagline,
  icons: [{ rel: "icon", url: config.app.favicon }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="dark">
        <ErrorBoundary>
          <Suspense fallback={<Loading />}>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </Suspense>
        </ErrorBoundary>
      </body>
    </html>
  );
}