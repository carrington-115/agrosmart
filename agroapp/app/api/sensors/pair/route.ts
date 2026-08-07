import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createPairingToken } from "@/lib/pairing";

/**
 * Mints a pairing link for the QR sensor-add flow, and renders it as a QR.
 *
 * The QR is generated here rather than in the browser so the pairing token never
 * has to reach client JavaScript as a value that could be logged or copied out of
 * a component's props — the page receives an image and a link, both of which the
 * user is about to display on screen anyway.
 *
 * The absolute URL is built from the request rather than an environment variable
 * because the phone must be able to reach it: on a LAN dev setup that is the
 * host's address, in production the public hostname, and the incoming request
 * already knows which.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let token: string;
  try {
    token = createPairingToken(user.id);
  } catch (cause) {
    // A missing signing key is a deployment misconfiguration. Say so plainly
    // rather than returning a link that would fail verification later.
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "QR pairing is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const url = `${origin}/pair/${token}`;

  const qr = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });

  return NextResponse.json({ url, qr });
}
