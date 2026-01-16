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

export const searchSchema = z.object({
  search: z.string().min(1),
});

export const chatSchema = z.object({
  message: z.string().min(1),
});

export const userProfileSchema = z.object({
  name: z.string().min(3).max(30),
  email: z.email(),
  address: z.string().min(5),
  phone: z.string().min(10).max(15),
  // profileImage: z.url(),
});

export const farmProfileSchema = z.object({
  country: z.string().min(3).max(30),
  city: z.string().min(3).max(30),
  address: z.string().min(5),
  state: z.string().min(3).max(30),
  farmSize: z.number().min(1),
  farmZones: z.number().min(1),
  farmType: z.string().min(3).max(30),
  farmName: z.string().min(3).max(30),
});
