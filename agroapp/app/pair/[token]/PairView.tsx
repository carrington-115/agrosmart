"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, CheckCircle2, Loader2, ScanLine } from "lucide-react";

/**
 * The phone half of QR pairing: scan the code on the sensor, register it.
 *
 * Scanning uses the platform `BarcodeDetector` API, which needs no dependency
 * but is not available everywhere — Safari and Firefox notably lack it. Rather
 * than shipping a decoder to cover them, the manual entry field is always
 * present and equally prominent. Typing the code off the sensor's label is a
 * complete path to the same result, so an unsupported browser is a slower
 * experience rather than a dead end.
 */

/** Minimal shape of the parts of BarcodeDetector this component uses. */
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function barcodeDetector(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

/**
 * Pulls a sensor code out of a scanned value.
 *
 * A sensor's QR may encode the bare code or a URL containing it, depending on how
 * the label was produced, so both are accepted. Anything else is rejected rather
 * than guessed at — registering a sensor under a mis-parsed id creates a device
 * that never reports and gives no clue why.
 */
export function parseScannedCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      candidate =
        url.searchParams.get("sensor") ??
        url.searchParams.get("id") ??
        url.pathname.split("/").filter(Boolean).pop() ??
        "";
    } catch {
      return null;
    }
  }

  candidate = candidate.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(candidate) ? candidate : null;
}

export default function PairView({ token }: { token: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sensorId, setSensorId] = useState("");
  const [sensorTag, setSensorTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const supportsScanning = barcodeDetector() !== null;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  // Release the camera when the component goes away. Leaving it running keeps
  // the recording indicator lit, which reads as a privacy problem.
  useEffect(() => stopCamera, [stopCamera]);

  async function startScanning() {
    const Detector = barcodeDetector();
    if (!Detector) return;

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new Detector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const code = found
            .map((b) => parseScannedCode(b.rawValue))
            .find((c): c is string => c !== null);

          if (code) {
            setSensorId(code);
            stopCamera();
            return;
          }
        } catch {
          // A single failed frame is normal — the camera may still be focusing.
          // Keep polling rather than tearing the scanner down.
        }
        requestAnimationFrame(() => void tick());
      };

      void tick();
    } catch {
      setError(
        "Could not open the camera. Allow camera access, or enter the sensor ID by hand below.",
      );
      setScanning(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/sensors/pair/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, sensorId, sensorTag }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "Could not register the sensor.");
        return;
      }
      setDone(body?.sensor?.sensor_code ?? sensorId);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <h1 className="text-xl font-bold">{done} is registered</h1>
        <p className="text-sm text-muted-foreground">
          It will appear on your dashboard as soon as it sends its first reading.
          You can close this page.
        </p>
      </div>
    );
  }

  const valid = parseScannedCode(sensorId) !== null && sensorTag.trim().length >= 3;

  return (
    <div className="flex w-full flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Add a sensor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan the QR code on the back of the sensor, or type the ID printed
          beside it.
        </p>
      </div>

      {supportsScanning && (
        <div className="flex flex-col gap-3">
          {scanning ? (
            <>
              <video
                ref={videoRef}
                className="aspect-square w-full rounded-xl bg-black object-cover"
                muted
                playsInline
              />
              <Button variant="secondary" onClick={stopCamera}>
                Stop scanning
              </Button>
            </>
          ) : (
            <Button onClick={startScanning}>
              <Camera className="mr-2 h-4 w-4" />
              Scan sensor QR code
            </Button>
          )}
        </div>
      )}

      {!supportsScanning && (
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          This browser cannot use the camera to scan codes. Enter the sensor ID
          printed on the device instead — it works exactly the same way.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="sensorId">Sensor ID</Label>
        <Input
          id="sensorId"
          value={sensorId}
          inputMode="text"
          autoCapitalize="characters"
          placeholder="AGS-001"
          onChange={(event) => setSensorId(event.target.value.toUpperCase())}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sensorTag">Name this sensor</Label>
        <Input
          id="sensorTag"
          value={sensorTag}
          placeholder="North field"
          onChange={(event) => setSensorTag(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          At least 3 characters, so you can tell it apart on the dashboard.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button disabled={!valid || submitting} onClick={submit}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <ScanLine className="mr-2 h-4 w-4" />
            Connect sensor
          </>
        )}
      </Button>
    </div>
  );
}
