import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anvil App - NextJS Bridge",
  description: "Anvil application running on NextJS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Core Anvil/Bootstrap CSS - served locally to avoid CORS */}
        <link
          rel="stylesheet"
          href="/anvil-css/bootstrap.css"
        />
        <link
          rel="stylesheet"
          href="/anvil-css/bootstrap-theme.min.css"
        />

        {/* Font Awesome for icons */}
        <link
          rel="stylesheet"
          href="/anvil-css/font-awesome.min.css"
        />

        {/* App-specific theme CSS - dynamically loaded from your app */}
        <link
          rel="stylesheet"
          href="/api/theme/theme.css"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
