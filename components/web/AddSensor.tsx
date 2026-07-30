"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImagePlus, Keyboard, Info, ArrowUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "../ui/form";
import { sensorSchema } from "@/lib/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { Input } from "../ui/input";
import { FieldError } from "../ui/field";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const addSensorButtons = [
  {
    icon: <ImagePlus size={64} />,
    title: "Add sensor by QR Code",
  },
  {
    icon: <Keyboard size={64} />,
    title: "Add sensor by ID",
  },
];

interface DialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: () => void;
}

export default function DialogWrapper({
  open,
  onOpenChange,
}: DialogWrapperProps) {
  const [openForm, setOpenForm] = useState<boolean>(false);
  type SensorFormValues = z.infer<typeof sensorSchema>;
  const sensorForm = useForm<SensorFormValues>({
    resolver: zodResolver(sensorSchema),
    defaultValues: {
      sensorId: "",
      sensorTag: "",
    },
  });
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const onSubmit = async (data: SensorFormValues) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/sensors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error ?? "Could not connect to the sensor.");
        return;
      }

      toast.success("Sensor connected successfully", {
        description: `${data.sensorId} is now registered.`,
      });
      setOpenForm(false);
      onOpenChange(false);
      sensorForm.reset();
      // Refresh so the sensors table and empty-state gate pick up the new row.
      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new sensor</DialogTitle>
        </DialogHeader>

        {openForm ? (
          <div>
            <Form {...sensorForm}>
              <form
                onSubmit={sensorForm.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <FormDescription>
                  For this process, you must make sure the sensor is powered on
                  and is connected to the internet. Go to our sensor
                  connectivity documentation page to{" "}
                  <Link href="/docs" className="underline">
                    learn more
                  </Link>
                </FormDescription>
                <FormField
                  control={sensorForm.control}
                  name="sensorId"
                  render={({ fieldState, field }) => (
                    <FormItem aria-invalid={fieldState.invalid}>
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Sensor ID
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="sensorId"
                          type="text"
                          placeholder="xxxxxxx"
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                      </FormControl>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={sensorForm.control}
                  name="sensorTag"
                  render={({ fieldState, field }) => (
                    <FormItem aria-invalid={fieldState.invalid}>
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Sensor Tag
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="sensorTag"
                          type="text"
                          placeholder="@sensorTag"
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                      </FormControl>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ArrowUpDown /> Connect to sensor
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        ) : (
          <div className="flex flex-row items-center justify-between gap-6 py-6">
            {addSensorButtons.map((button) => (
              <Button
                key={button.title}
                variant="ghost"
                className="flex flex-col items-center gap-4 p-8 h-auto max-w-[220px] w-full rounded-xl bg-primary-container/50 hover:bg-primary-container text-on-primary-container transition-colors"
                disabled={button.title === "Add sensor by QR Code"}
                onClick={
                  button.title === "Add sensor by ID"
                    ? () => setOpenForm(true)
                    : undefined
                }
              >
                {button.icon}
                <span className="text-base font-medium">{button.title}</span>
              </Button>
            ))}
          </div>
        )}

        {!openForm && (
          <DialogFooter className="sm:justify-start">
            <div className="flex items-center gap-2 ">
              {<Info size={24} />}
              <DialogDescription className="m-0 text-xs">
                Public links can be reshared. Share responsibly. Opens in a new
                window, delete anytime. If sharing with third-parties, their
                policies apply.
              </DialogDescription>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
