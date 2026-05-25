import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { config } from "~/config";

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
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}