import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { forwardError } from "@/lib/forward";

/** Delete one sensor by its device code. RLS restricts this to the owner. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  try {
    // agroapi answers 204, so there is no body to forward.
    await apiFetch<void>(
      `/v1/sensors/${encodeURIComponent(decodeURIComponent(code))}`,
      { method: "DELETE" },
    );
    return NextResponse.json({ deleted: code });
  } catch (error) {
    return forwardError(error);
  }
}
