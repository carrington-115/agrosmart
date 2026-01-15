"use client";

import { HeaderProps, HeaderType } from "@/lib/types";
import { Button } from "../ui/button";
import { Share2 } from "lucide-react";

export default function DashboardHeader({
  leftContent,
  rightContent,
  type,
  title,
  greeting,
  getReport,
}: HeaderProps) {
  return (
    <div className="w-full max-w-full mx-auto flex justify-between items-center pt-[40px] px-4 pb-[10px]">
      <div>
        {type === HeaderType.DASHBOARD ? (
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-bold">{title}</h1>
            <p className="text-[14px] text-muted-foreground">{greeting}</p>
          </div>
        ) : (
          <div>{leftContent}</div>
        )}
      </div>
      <div className="w-auto flex items-center gap-4">
        {rightContent}{" "}
        {getReport && (
          <Button className="hover:bg-on-primary-container">
            <>
              <Share2 />
            </>{" "}
            Generate report
          </Button>
        )}
      </div>
    </div>
  );
}
