import { recommendationsCardProps } from "@/lib/types";
import { twMerge } from "tailwind-merge";

export default function RecommendationCard({
  title,
  content,
  color,
}: recommendationsCardProps) {
  return (
    <>
      <div
        className={twMerge(
          "w-full flex items-start justify-start p-4 gap-[10px] rounded-md",
          color &&
            `${color}/50 hover:${color}/70 transition-colors cursor-pointer`
        )}
        style={{
          outlineColor: `${color}`,
          outlineWidth: "1px",
          outlineStyle: "solid",
          outlineOffset: "1px",
        }}
      >
        {/* <span
          className="flex-inline w-4 h-4 rounded-full"
          style={{
            backgroundColor: `${color}`,
            opacity: "30%",
          }}
        /> */}
        <div
          className={`flex flex-col gap-[5px]`}
          style={{
            color: `${color}`,
          }}
        >
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs">{content}</p>
        </div>
      </div>
    </>
  );
}
