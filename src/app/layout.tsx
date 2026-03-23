import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-inter",
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
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
