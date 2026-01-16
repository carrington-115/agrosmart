"use client";

import { useForm } from "react-hook-form";
import { farmProfileSchema, userProfileSchema } from "@/lib/schema";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { ImagePlus, Loader, Pencil, Save } from "lucide-react";
import { Button } from "../ui/button";
import { useState, useTransition } from "react";
import { Input } from "../ui/input";
import Image from "next/image";
import profileImage from "@/assets/images/profile.png";

export default function UserProfileInput({
  farmSettings,
}: {
  farmSettings: boolean;
}) {
  type profileFormType = z.infer<typeof userProfileSchema>;

  const [pending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState<boolean>(true);
  const profileForm = useForm<profileFormType>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      name: "",
      email: "frumarkcarrington@gmail.com",
      address: "",
      phone: "",
    },
  });

  type farmProfileFormType = z.infer<typeof farmProfileSchema>;
  const farmProfileForm = useForm<farmProfileFormType>({
    resolver: zodResolver(farmProfileSchema),
    defaultValues: {
      country: "",
      city: "",
      address: "",
      state: "",
      farmSize: 0,
      farmZones: 0,
      farmType: "",
      farmName: "",
    },
  });

  const onSubmit = (data: profileFormType) => {
    console.log(data);
    startTransition(() => {
      setEditMode(!editMode);
    });
  };

  const onSubmitFarm = (data: farmProfileFormType) => {
    console.log(data);
    startTransition(() => {
      setEditMode(!editMode);
    });
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-5 w-[80%] bg-primary-container py-10 rounded-xl">
        <Form {...profileForm}>
          <form
            onSubmit={profileForm.handleSubmit(onSubmit)}
            className="flex flex-col items-center gap-3 w-[50%]"
          >
            {editMode ? (
              <>
                <Button
                  className="bg-on-primary-container hover:bg-on-primary-container text-primary-container"
                  variant={"secondary"}
                  type="button"
                >
                  <ImagePlus />
                  Upload profile image
                </Button>

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormControl>
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@example.com"
                          aria-invalid={fieldState.invalid}
                          className="bg-white"
                          disabled
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormControl>
                        <Input
                          id="name"
                          type="text"
                          placeholder="Name"
                          aria-invalid={fieldState.invalid}
                          className="bg-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="address"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormControl>
                        <Input
                          id="address"
                          type="text"
                          placeholder="Address"
                          aria-invalid={fieldState.invalid}
                          className="bg-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="phone"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormControl>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Phone number"
                          aria-invalid={fieldState.invalid}
                          className="bg-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div>
                  <Image
                    src={profileImage}
                    alt="profile"
                    width={100}
                    height={100}
                    className="rounded-full"
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-base font-medium">
                    {profileForm.watch("name")}
                  </p>
                  <p className="text-base font-medium">
                    {profileForm.watch("email")}
                  </p>
                  <p className="text-base font-medium">
                    {profileForm.watch("address")}
                  </p>
                  <p className="text-base font-medium">
                    {profileForm.watch("phone")}
                  </p>
                </div>
              </div>
            )}
            <Button type="submit" className="bg-primary">
              {pending ? (
                <Loader className="animate-spin" />
              ) : editMode ? (
                <Save />
              ) : (
                <Pencil />
              )}
              {editMode ? "Update profile" : "Edit profile"}
            </Button>
          </form>
        </Form>
      </div>

      {farmSettings && (
        <div className="flex flex-col items-center gap-5 w-[80%] bg-primary-container py-10 rounded-xl">
          <Form {...farmProfileForm}>
            <form
              onSubmit={farmProfileForm.handleSubmit(onSubmitFarm)}
              className="flex flex-col gap-3 w-[80%]"
            >
              <p className="text-lg font-semibold">Farm settings</p>
              <div className="w-full flex items-center gap-2 w-[45%]">
                <FormField
                  control={farmProfileForm.control}
                  name="country"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Country
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="country"
                          type="text"
                          placeholder="Country"
                          aria-invalid={fieldState.invalid}
                          {...field}
                          className="bg-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={farmProfileForm.control}
                  name="city"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        City
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="city"
                          type="text"
                          placeholder="City"
                          aria-invalid={fieldState.invalid}
                          {...field}
                          className="bg-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="w-full flex items-center gap-2 w-[45%]">
                <FormField
                  control={farmProfileForm.control}
                  name="address"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="address"
                          type="text"
                          placeholder="Address"
                          aria-invalid={fieldState.invalid}
                          {...field}
                          className="bg-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={farmProfileForm.control}
                  name="state"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        State
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="state"
                          type="text"
                          placeholder="State"
                          aria-invalid={fieldState.invalid}
                          {...field}
                          className="bg-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="w-full flex items-center gap-2 w-[45%]">
                <FormField
                  control={farmProfileForm.control}
                  name="farmSize"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Farm Size
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="farmSize"
                          type="number"
                          placeholder="Farm Size"
                          aria-invalid={fieldState.invalid}
                          {...field}
                          className="bg-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={farmProfileForm.control}
                  name="farmZones"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Farm Zones
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="farmZones"
                          type="number"
                          placeholder="Farm Zones"
                          aria-invalid={fieldState.invalid}
                          {...field}
                          className="bg-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="w-full flex items-center gap-2 w-[45%]">
                <FormField
                  control={farmProfileForm.control}
                  name="farmType"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Farm Type
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="farmType"
                          type="text"
                          placeholder="Farm Type"
                          aria-invalid={fieldState.invalid}
                          {...field}
                          className="bg-white"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={farmProfileForm.control}
                  name="farmName"
                  render={({ fieldState, field }) => (
                    <FormItem
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <FormLabel aria-invalid={fieldState.invalid}>
                        Farm Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="farmName"
                          type="text"
                          placeholder="Farm Name"
                          aria-invalid={fieldState.invalid}
                          className="bg-white"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button>
                {pending ? <Loader className="animate-spin" /> : <Save />}{" "}
                Update farm
              </Button>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
