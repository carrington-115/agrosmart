import { useForm } from "react-hook-form";
import { userProfileSchema } from "@/lib/schema";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "../ui/form";
import { ImagePlus, Pencil, Save } from "lucide-react";
import { Button } from "../ui/button";
import { useState } from "react";
import { Input } from "../ui/input";

export default function UserProfileInput() {
  type profileFormType = z.infer<typeof userProfileSchema>;

  const [editMode, setEditMode] = useState<boolean>(false);
  const profileForm = useForm<profileFormType>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      name: "",
      email: "frumarkcarrington@gmail.com",
      address: "",
      phone: "",
    },
  });

  const onSubmit = (data: profileFormType) => {
    console.log(data);
  };

  return (
    <div className="flex flex-col items-center gap-5 w-[80%] bg-primary-container/30 py-10 rounded-xl">
      <Button
        className="bg-primary-container/50 hover:bg-primary-container text-on-primary-container"
        variant={"secondary"}
      >
        <ImagePlus />
        Upload profile image
      </Button>
      <Form {...profileForm}>
        <form
          onSubmit={profileForm.handleSubmit(onSubmit)}
          className="flex flex-col items-center gap-3 w-[50%]"
        >
          <FormField
            control={profileForm.control}
            name="email"
            render={({ fieldState, field }) => (
              <FormItem aria-invalid={fieldState.invalid} className="w-full">
                <FormControl>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    aria-invalid={fieldState.invalid}
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
              <FormItem aria-invalid={fieldState.invalid} className="w-full">
                <FormControl>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Name"
                    aria-invalid={fieldState.invalid}
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
              <FormItem aria-invalid={fieldState.invalid} className="w-full">
                <FormControl>
                  <Input
                    id="address"
                    type="text"
                    placeholder="Address"
                    aria-invalid={fieldState.invalid}
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
              <FormItem aria-invalid={fieldState.invalid} className="w-full">
                <FormControl>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Phone number"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" className="bg-primary">
            {editMode ? <Pencil /> : <Save />}
            {editMode ? "Edit profile" : "Update profile"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
