import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgroSmart",
  description: "Optimizing Precision Agriculture with IoT and LLMs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` is required, not defensive. next-themes writes the
    // resolved theme onto <html> in a blocking inline script before React hydrates,
    // so the server-rendered markup and the client's first read of it genuinely
    // differ. That mismatch is the mechanism that prevents a flash of the wrong
    // theme; without this attribute React logs an error for working code.
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} ${robotoMono.variable} antialiased`}>
        <ThemeProvider>
          <SidebarProvider>
            <main className="w-full max-w-full container">{children}</main>
            <Toaster />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
