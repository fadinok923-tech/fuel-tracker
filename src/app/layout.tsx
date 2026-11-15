import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/fleet/theme-provider";
import { ServiceWorkerRegistration } from "@/components/fleet/service-worker-registration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tanoor Fleet Management",
  description: "Enterprise-grade fleet fuel, mileage, and maintenance management system",
  keywords: ["fleet", "fuel", "mileage", "maintenance", "van", "logistics"],
  applicationName: "Tanoor Fleet Management",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tanoor Fleet",
  },
  icons: {
    icon: [
      { url: "/icons/tanoor-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/tanoor-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/tanoor-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#8f1f32",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ServiceWorkerRegistration />
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
