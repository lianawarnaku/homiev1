import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://homie-application.com"),
  title: {
    default: "Homie — A happier home, together",
    template: "%s | Homie",
  },
  description:
    "Share chores, expenses, shopping, and borrowed items with your household.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={barlow.variable}>{children}</body>
    </html>
  );
}
