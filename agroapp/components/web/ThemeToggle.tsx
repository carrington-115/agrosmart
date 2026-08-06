"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/**
 * Light / dark / system, cycling in that order.
 *
 * A three-state cycle rather than a two-state switch, because "system" is a real
 * preference and not a default to be silently discarded: a farmer whose phone
 * flips to dark at sunset should get that here too unless they said otherwise.
 * next-themes persists the choice in localStorage, so it survives a reload.
 *
 * There is no `mounted` flag here, which the usual next-themes recipe calls for.
 * It is unnecessary because nothing rendered below depends on `resolvedTheme` —
 * the only value that differs between the server and the client's first paint.
 * `theme` is `undefined` in both, so `theme ?? "system"` agrees on both sides and
 * there is no mismatch to guard against. Adding the flag would mean a `setState`
 * in an effect, a cascading render on every page load, and a frame of placeholder.
 */

const ORDER = ["light", "dark", "system"] as const;

type ThemeName = (typeof ORDER)[number];

const LABEL: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const ICON: Record<ThemeName, typeof Sun> = {
  light: Sun,
  dark: Moon,
  // Deliberately the monitor rather than whichever the OS resolved to: the button
  // reports how the theme was *chosen*, and "following your device" is the fact
  // worth showing. The screen itself already says which one that produced.
  system: Monitor,
};

export default function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  const current = (ORDER as readonly string[]).includes(theme ?? "")
    ? (theme as ThemeName)
    : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current];

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setTheme(next)}
        aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next]}.`}
        title={`Theme: ${LABEL[current]} — click for ${LABEL[next]}`}
        className="hover:!bg-on-primary-container/5 hover:!text-on-primary-container"
      >
        <Icon className={collapsed ? "!size-5" : undefined} />
        <span>{LABEL[current]}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
