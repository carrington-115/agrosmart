import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { forwardError, readJson } from "@/lib/forward";
import { farmProfileSchema, userProfileSchema } from "@/lib/schema";
import type { ApiMe } from "@/lib/api-types";

/**
 * Profile and farm forms.
 *
 * Two verbs on one route, kept as they were so the form components did not have to
 * change: PUT is the user profile, POST is the farm. Both forward to
 * `PUT /v1/me`, which takes either or both.
 *
 * The zod schemas stay. agroapi validates too, and its rules are the ones that
 * matter — but these are what give the form inline field errors, so validating
 * twice is the point rather than a duplication.
 */

export async function PUT(request: Request) {
  const parsed = userProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const me = await apiFetch<ApiMe>("/v1/me", {
      method: "PUT",
      body: JSON.stringify({
        profile: {
          name: parsed.data.name,
          email: parsed.data.email,
          address: parsed.data.address,
          phone: parsed.data.phone,
        },
      }),
    });
    return NextResponse.json({ ok: true, profile: me.profile });
  } catch (error) {
    return forwardError(error);
  }
}

export async function POST(request: Request) {
  const parsed = farmProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid farm payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const me = await apiFetch<ApiMe>("/v1/me", {
      method: "PUT",
      body: JSON.stringify({
        farm: {
          farmName: parsed.data.farmName,
          farmType: parsed.data.farmType,
          farmSize: parsed.data.farmSize,
          farmZones: parsed.data.farmZones,
          country: parsed.data.country,
          state: parsed.data.state,
          city: parsed.data.city,
          address: parsed.data.address,
        },
      }),
    });
    return NextResponse.json({ ok: true, farm: me.farm });
  } catch (error) {
    return forwardError(error);
  }
}
