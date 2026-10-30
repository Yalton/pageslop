import type { Metadata } from "next";
import { Source_Sans_3, Zilla_Slab } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-sans",
});

// Headings, card titles and the wordmark. Both font variables sit on <html> so
// the theme variables on :root (--font-sans, --font-display) can resolve them.
const display = Zilla_Slab({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-zilla-slab",
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
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
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
