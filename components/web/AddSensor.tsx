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

  const onSubmit = (data: SensorFormValues) => {
    startTransition(() => {
      toast.success("Sensor connected successfully", {
        description: "Sensor connected successfully",
      });
      setOpenForm(false);
      onOpenChange(false);
      sensorForm.reset();
    });
  };

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
                <Button type="submit">
                  {pending ? (
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
