import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "PRISM Strategic Intelligence",
  description: "Multi-engine strategic intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen app-shell">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
