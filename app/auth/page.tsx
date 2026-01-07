"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { zodLoginSchema } from "@/lib/types";
import { LoginSchema, signupSchema } from "@/lib/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { FieldError } from "@/components/ui/field";
import Image from "next/image";
import logoLight from "@/assets/images/logo-light.svg";
import logoDark from "@/assets/images/logo-dark.svg";

// card title
function LogoTitle() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src={logoLight}
          alt="Logo"
          width={24}
          height={24}
          className="dark:hidden"
        />
        <Image
          src={logoDark}
          alt="Logo"
          width={100}
          height={100}
          className="hidden dark:block"
        />
        <span>
          <h1>AgroSmart</h1>
        </span>
      </Link>
    </div>
  );
}

export default function Login() {
  type loginFormValues = z.infer<typeof LoginSchema>;
  const loginForm = useForm<loginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  type signupFormValues = z.infer<typeof signupSchema>;
  const signupForm = useForm<signupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onLoginSubmit = (data: zodLoginSchema) => {
    console.log(data);
  };

  const onSignupSubmit = (data: zodLoginSchema) => {
    console.log(data);
  };

  return (
    <div className="flex w-full max-w-sm max-h-auto flex-col gap-6">
      <Tabs defaultValue="login">
        <TabsList>
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>
                <LogoTitle />
              </CardTitle>
              <CardDescription>
                Welcome to AgroSmart! Get valuable crop health insights,
                preventive tips, and instant alerts to protect your fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form
                  onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                  className="flex flex-col gap-2"
                >
                  {/* Email */}

                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ fieldState, field }) => (
                      <FormItem aria-invalid={fieldState.invalid}>
                        <FormLabel aria-invalid={fieldState.invalid}>
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="email"
                            type="email"
                            placeholder="email@example.com"
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

                  {/* Password */}
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ fieldState, field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            id="password"
                            type="password"
                            placeholder="password"
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
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="hover:bg-on-primary-container cursor-pointer"
                >
                  Login
                </Button>
                <Button variant="outline" className="cursor-pointer">
                  Login with Google
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="link"
                  className="hover:text-on-primary-container cursor-pointer"
                >
                  Forgot Password
                </Button>
                <Button
                  variant="link"
                  className="hover:text-on-primary-container cursor-pointer"
                >
                  Sign up instead?
                </Button>
              </div>
              <p className="text-center text-sm/2 mt-2">
                By continuing, you indicate that you have read and agree to our{" "}
                <span>
                  <Link
                    href="/"
                    className={twMerge(
                      buttonVariants({ variant: "link" }),
                      "px-0 underline hover:text-on-primary-container"
                    )}
                  >
                    Terms
                  </Link>
                </span>{" "}
                and{" "}
                <span>
                  <Link
                    href="/"
                    className={twMerge(
                      buttonVariants({ variant: "link" }),
                      "px-0 underline hover:text-on-primary-container"
                    )}
                  >
                    Privacy Policy
                  </Link>
                </span>
                .
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
          <Card>
            <CardHeader>
              <CardTitle>
                <LogoTitle />
              </CardTitle>
              <CardDescription>
                Welcome to AgroSmart! Get valuable crop health insights,
                preventive tips, and instant alerts to protect your fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...signupForm}>
                <form
                  onSubmit={signupForm.handleSubmit(onSignupSubmit)}
                  className="flex flex-col gap-2"
                >
                  {/* Name */}

                  <FormField
                    control={signupForm.control}
                    name="name"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            id="name"
                            type="text"
                            placeholder="John Doe"
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

                  {/* Email */}

                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            id="email"
                            type="email"
                            placeholder="email@example.com"
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

                  {/* Password */}

                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            id="password"
                            type="password"
                            placeholder="password"
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

                  {/* Confirm Password */}

                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field, fieldState }) => (
                      <FormItem aria-invalid={fieldState.invalid}>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl aria-invalid={fieldState.invalid}>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="confirmPassword"
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
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="hover:bg-on-primary-container cursor-pointer"
                >
                  Sign up
                </Button>
                <Button variant="outline" className="cursor-pointer">
                  Sign up with Google
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="link"
                  className="hover:text-on-primary-container cursor-pointer"
                >
                  Forgot password?
                </Button>
                <Button
                  variant="link"
                  className="hover:text-on-primary-container cursor-pointer"
                >
                  Sign up instead?
                </Button>
              </div>
              <p className="text-center text-sm/2 mt-2">
                By continuing, you indicate that you have read and agree to our{" "}
                <span>
                  <Link
                    href="/"
                    className={twMerge(
                      buttonVariants({ variant: "link" }),
                      "px-0 underline hover:text-on-primary-container"
                    )}
                  >
                    Terms
                  </Link>
                </span>{" "}
                and{" "}
                <span>
                  <Link
                    href="/"
                    className={twMerge(
                      buttonVariants({ variant: "link" }),
                      "px-0 underline hover:text-on-primary-container"
                    )}
                  >
                    Privacy Policy
                  </Link>
                </span>
                .
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
