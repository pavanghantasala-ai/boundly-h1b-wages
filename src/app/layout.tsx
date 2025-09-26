import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Boundly - Prevailing Wage & H-1B Calculator",
  description: "Find your prevailing wage level and H-1B selection weighting",
  keywords: ["H-1B", "prevailing wage", "wage level", "immigration", "PERM", "LCA"],
  authors: [
    {
      name: "Boundly Team",
      url: "https://boundly.app",
    },
  ],
  creator: "Boundly",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://boundly.app",
    title: "Boundly - Prevailing Wage & H-1B Calculator",
    description: "Find your prevailing wage level and H-1B selection weighting",
    siteName: "Boundly",
  },
  twitter: {
    card: "summary_large_image",
    title: "Boundly - Prevailing Wage & H-1B Calculator",
    description: "Find your prevailing wage level and H-1B selection weighting",
    images: ["https://boundly.app/og-image.jpg"],
    creator: "@boundly",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
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
