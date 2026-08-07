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

/*
 * The device telemetry envelope used to be mirrored here, for the Next.js ingest
 * route that has since been retired. agroapi owns ingest now — with per-device
 * tokens rather than one shared key — so a second copy of the wire contract in a
 * second language was two things to keep in step for no benefit. The authoritative
 * mirror is `agroapi/src/agroapi/schemas/ingest.py`.
 */

export const alertStateSchema = z.object({
  state: z.enum(["open", "accepted", "rejected"]),
});

/**
 * Settings PUT body. Every field optional so the client can send only what
 * changed, but `.strict()` so a typo'd key is rejected rather than silently
 * ignored — a preference that appears to save and does not is worse than an error.
 */
export const userSettingsSchema = z
  .object({
    pair_by_id: z.boolean(),
    pair_by_qr: z.boolean(),
    reports_weekly: z.boolean(),
    reports_monthly: z.boolean(),
    reports_email: z.boolean(),
    alerts_dashboard: z.boolean(),
    alerts_popup: z.boolean(),
    alerts_email: z.boolean(),
    alerts_sms: z.boolean(),
    alerts_delete_ignored_after_days: z.number().int().min(0).max(365),
  })
  .partial()
  .strict();
