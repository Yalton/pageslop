import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

// Headings and the wordmark. Both font variables sit on <html> so the theme
// variables on :root (--font-sans, --font-display) can resolve them.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: {
    default: "Pageslop",
    template: "%s | Pageslop",
  },
  description: "Save links. Skip the busywork. Pageslop auto-classifies, tags, and organizes your bookmarks so you don't have to.",
  openGraph: {
    title: "Pageslop",
    description: "Save links. Skip the busywork. Auto-classify, tag, and organize your bookmarks.",
    url: "https://pageslop.citreum.com",
    siteName: "Pageslop",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Pageslop",
    description: "Save links. Skip the busywork.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
