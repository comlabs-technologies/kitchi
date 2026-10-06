import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kitchi — The operating system for independent restaurants", template: "%s · Kitchi" },
  description: "Billing, orders, tables, kitchen, menu, inventory and reports for cafés, restaurants and cloud kitchens.",
  applicationName: "Kitchi",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fafaf8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-sm focus:text-white">Skip to content</a>
        {children}
        <Toaster position="bottom-right" closeButton toastOptions={{ classNames: { toast: "!rounded-lg !border !border-line !bg-surface !text-[13px] !shadow-pop", title: "!font-medium" }, duration: 3200 }} />
      </body>
    </html>
  );
}
