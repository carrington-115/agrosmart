import { verifyPairingToken } from "@/lib/pairing";
import { AlertCircle } from "lucide-react";
import PairView from "./PairView";

/**
 * The mobile pairing page a phone reaches by scanning the desktop's QR.
 *
 * Deliberately outside `/dashboard`: the phone has no session, so it must not sit
 * behind the auth redirect in `proxy.ts`. Its authority comes from the signed
 * token in the URL instead, verified here before anything is rendered.
 *
 * The token is checked server-side so an expired or forged link shows an
 * explanation rather than a form that would fail on submit.
 */
export default async function PairPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const claims = verifyPairingToken(token);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      {claims ? (
        <PairView token={token} />
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
          <h1 className="text-xl font-bold">This pairing link has expired</h1>
          <p className="text-sm text-muted-foreground">
            Pairing links are valid for ten minutes. Open the dashboard on your
            computer, choose <strong>Add sensor by QR Code</strong> again, and
            scan the new code.
          </p>
        </div>
      )}
    </main>
  );
}
