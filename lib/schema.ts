import z from "zod";

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(30),
});

export const signupSchema = z
  .object({
    name: z.string().min(3).max(30),
    email: z.email(),
    password: z.string().min(6).max(30),
    confirmPassword: z.string().min(6).max(30),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
