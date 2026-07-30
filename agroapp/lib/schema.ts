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

/**
 * `sensorId` is the code printed on the device. It was previously `.length(7)`,
 * which no real identifier satisfied — every seeded sensor looks like
 * `SENSOR-LKO-001` (14 chars) — so the form could never produce a usable value.
 * Now accepts alphanumerics plus dashes/underscores at a realistic length.
 */
export const sensorSchema = z.object({
  sensorId: z
    .string()
    .trim()
    .min(4, "Sensor ID must be at least 4 characters")
    .max(32, "Sensor ID must be at most 32 characters")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
      "Use letters, numbers, dashes or underscores only",
    )
    .transform((value) => value.toUpperCase()),
  sensorTag: z.string().trim().min(3).max(16),
});

export const ingestReadingSchema = z.object({
  sensorId: z.string().trim().min(1),
  recordedAt: z.iso.datetime().optional(),
  temperature: z.number().min(-50).max(100).optional(),
  ph: z.number().min(0).max(14).optional(),
  sunlight: z.number().min(0).optional(),
  moisture: z.number().min(0).max(100).optional(),
  salinity: z.number().min(0).optional(),
  nitrogen: z.number().min(0).optional(),
  phosphorus: z.number().min(0).optional(),
  potassium: z.number().min(0).optional(),
});

export const alertStateSchema = z.object({
  state: z.enum(["open", "accepted", "rejected"]),
});
