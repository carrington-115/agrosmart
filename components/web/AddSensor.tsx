"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImagePlus, Keyboard, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const addSensorButtons = [
  { icon: <ImagePlus size={64} />, title: "Add sensor by QR Code" },
  { icon: <Keyboard size={64} />, title: "Add sensor by ID" },
];

interface DialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DialogWrapper({
  open,
  onOpenChange,
}: DialogWrapperProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form className="w-full">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new sensor</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-6">
            {addSensorButtons.map((button) => (
              <Button
                key={button.title}
                variant="outline"
                className="flex flex-col items-center gap-4 p-8 h-auto w-full max-w-[220px] rounded-xl bg-primary-container/50 hover:bg-primary-container text-on-primary-container transition-colors"
              >
                {button.icon}
                <span className="text-base font-medium">{button.title}</span>
              </Button>
            ))}
          </div>

          <DialogFooter className="sm:justify-start">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <DialogDescription className="m-0">
                Public links can be reshared. Share responsibly. Opens in a new
                window, delete anytime. If sharing with third-parties, their
                policies apply.
              </DialogDescription>
            </div>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}
