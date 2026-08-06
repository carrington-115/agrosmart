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

interface DialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: () => void;
}

/** Which pane of the dialog is showing. */
type Mode = "choose" | "id" | "qr";

export default function DialogWrapper({
  open,
  onOpenChange,
}: DialogWrapperProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [pairing, setPairing] = useState<{ url: string; qr: string } | null>(
    null,
  );
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const openForm = mode === "id";
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
      setMode("choose");
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

  /**
   * Requests a pairing link and its QR from the server.
   *
   * The QR is rendered server-side, so the token arrives as an image plus a URL
   * ready to display rather than something the browser has to encode itself.
   */
  async function startQrPairing() {
    setMode("qr");
    setPairLoading(true);
    setPairError(null);
    setPairing(null);
    try {
      const response = await fetch("/api/sensors/pair", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setPairError(body?.error ?? "Could not create a pairing link.");
        return;
      }
      setPairing({ url: body.url, qr: body.qr });
    } catch {
      setPairError("Network error. Please try again.");
    } finally {
      setPairLoading(false);
    }
  }

  // Reset to the chooser whenever the dialog closes, so reopening it does not
  // show a stale pairing link that may already have expired.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode("choose");
      setPairing(null);
      setPairError(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new sensor</DialogTitle>
        </DialogHeader>

        {mode === "qr" ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <DialogDescription className="text-center">
              Scan this code with your phone. It opens a page where you can scan
              the QR code on the back of the sensor.
            </DialogDescription>

            {pairLoading && (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            )}

            {pairError && (
              <p className="text-center text-sm text-destructive">{pairError}</p>
            )}

            {pairing && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a data:
                    URI generated per request; next/image would add a loader
                    round trip for bytes we already hold. */}
                <img
                  src={pairing.qr}
                  alt="QR code linking to the sensor pairing page"
                  width={240}
                  height={240}
                  className="rounded-lg border"
                />
                <p className="text-center text-xs text-muted-foreground">
                  This link works for ten minutes. Anyone who opens it can add a
                  sensor to your account, so do not share it.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(pairing.url);
                    toast.success("Pairing link copied");
                  }}
                >
                  Copy link instead
                </Button>
              </>
            )}

            <Button variant="secondary" onClick={() => setMode("choose")}>
              Back
            </Button>
          </div>
        ) : openForm ? (
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
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-4 p-8 h-auto max-w-[220px] w-full rounded-xl bg-primary-container/50 hover:bg-primary-container text-on-primary-container transition-colors"
              onClick={startQrPairing}
            >
              <ImagePlus size={64} />
              <span className="text-base font-medium">
                Add sensor by QR Code
              </span>
            </Button>
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-4 p-8 h-auto max-w-[220px] w-full rounded-xl bg-primary-container/50 hover:bg-primary-container text-on-primary-container transition-colors"
              onClick={() => setMode("id")}
            >
              <Keyboard size={64} />
              <span className="text-base font-medium">Add sensor by ID</span>
            </Button>
          </div>
        )}

        {mode === "choose" && (
          <DialogFooter className="sm:justify-start">
            <div className="flex items-center gap-2 ">
              {<Info size={24} />}
              <DialogDescription className="m-0 text-xs">
                Pairing links are valid for ten minutes and let whoever holds
                them add a sensor to your account. Treat one like a password.
              </DialogDescription>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
