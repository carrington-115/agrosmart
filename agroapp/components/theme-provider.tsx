"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Theme context for the app.
 *
 * A thin wrapper so `app/layout.tsx` can stay a server component: `next-themes`
 * uses context and effects, so it has to be a client boundary, but the layout
 * around it does not.
 *
 * `attribute="class"` is required rather than preferred — `app/globals.css:4`
 * declares `@custom-variant dark (&:is(.dark *))`, so every `dark:` utility in the
 * app is compiled against a `.dark` **class** on an ancestor. The default
 * `data-theme` attribute would set an attribute nothing is looking at, and the
 * toggle would appear to do nothing.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Transitions on a colour change look like a slow repaint rather than a
      // deliberate switch, and they animate every token at once.
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
