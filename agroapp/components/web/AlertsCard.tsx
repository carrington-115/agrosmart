"use client";

import { alertsCardProps } from "@/lib/types";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Check, X } from "lucide-react";

/**
 * One alert.
 *
 * The three action props used to be declared on `alertsCardProps` and passed in
 * by `AlertsView`, but never destructured here — so the tick, cross and "View
 * details" buttons rendered with no `onClick` and the entire accept/reject flow
 * behind them (the PATCH, the optimistic update, the toasts) was unreachable.
 * They are wired now.
 */
export default function AlertsCard({
  title,
  description,
  badgeType,
  badgeInfo,
  state,
  derived,
  busy,
  viewAction,
  acceptAction,
  rejectAction,
}: alertsCardProps) {
  const resolved = state === "accepted" || state === "rejected";

  return (
    <Card className="mx-auto w-full h-full text-on-primary-container bg-primary-container/20 shadow-none hover:bg-primary-container/40">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-medium font-bold text-on-primary-container">
          {title}
        </CardTitle>
        <Badge variant={badgeType}>{badgeInfo}</Badge>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm font-medium line-clamp-3">
          {description}
        </CardDescription>
      </CardContent>
      <CardFooter className="w-full flex justify-between items-center">
        <div className="flex gap-2 items-center">
          {/* A derived alert is computed from the latest readings rather than
              stored, so there is no row to mark resolved. Hiding the controls is
              honest; offering them and silently doing nothing is not. */}
          {derived ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="font-normal">
                  Live
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Derived from current sensor readings. It clears on its own once
                the reading returns to range.
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Button
                size="icon-lg"
                aria-label="Mark as resolved"
                disabled={busy || resolved}
                onClick={acceptAction}
                className="rounded-full !bg-primary-container/70 !text-on-primary-container hover:!bg-primary-container"
              >
                <Check />
              </Button>
              <Button
                size="icon-lg"
                aria-label="Ignore alert"
                disabled={busy || resolved}
                onClick={rejectAction}
                className="rounded-full !bg-primary-container !text-on-primary-container"
              >
                <X />
              </Button>
            </>
          )}
          {resolved && (
            <span className="text-xs text-on-primary-container/70">
              {state === "accepted" ? "Resolved" : "Ignored"}
            </span>
          )}
        </div>
        <CardAction>
          <Button
            onClick={viewAction}
            className="bg-on-primary-container !text-primary-container hover:!bg-on-primary-container"
          >
            View Details
          </Button>
        </CardAction>
      </CardFooter>
    </Card>
  );
}
