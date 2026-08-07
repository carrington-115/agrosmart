import { recommendationsCardProps } from "@/lib/types";
import { twMerge } from "tailwind-merge";

/**
 * One recommendation.
 *
 * The accent used to be an inline `style={{ color }}` carrying a raw hex, which
 * pinned the text to one lightness. A hex chosen to read on white does not read on
 * `oklch(0.145)`, so every card was going to be either washed out or muddy in one
 * theme. These are Tailwind pairs with `dark:` variants instead — the same accent
 * family, stepped lighter where the background is dark.
 */

const ACCENT: Record<string, string> = {
  green:
    "border-green-600/40 bg-green-600/5 text-green-800 dark:border-green-400/40 dark:bg-green-400/10 dark:text-green-300",
  orange:
    "border-orange-600/40 bg-orange-600/5 text-orange-800 dark:border-orange-400/40 dark:bg-orange-400/10 dark:text-orange-300",
  red: "border-red-600/40 bg-red-600/5 text-red-800 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300",
  blue: "border-blue-600/40 bg-blue-600/5 text-blue-800 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-300",
};

export default function RecommendationCard({
  title,
  content,
  color,
}: recommendationsCardProps) {
  return (
    <div
      className={twMerge(
        "w-full flex items-start justify-start gap-[10px] rounded-md border p-4 transition-colors",
        ACCENT[color] ?? ACCENT.orange,
      )}
    >
      <div className="flex flex-col gap-[5px]">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs opacity-90">{content}</p>
      </div>
    </div>
  );
}
