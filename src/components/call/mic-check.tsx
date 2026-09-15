"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Permission = "idle" | "requesting" | "granted" | "denied" | "unavailable";

type Preview = { stream: MediaStream; context: AudioContext; frame: number };

/** Per-browser steps to re-allow a blocked microphone (spec §11.10 step 3). */
function microphoneHelp(): string {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent)) {
    return "On iPhone or iPad: open Settings → Safari → Microphone, choose Allow, then come back and reload this page.";
  }
  if (/Firefox\//.test(agent)) {
    return "In Firefox: click the microphone icon in the address bar, clear the blocked permission, then reload this page.";
  }
  if (/Edg\//.test(agent) || /Chrome\//.test(agent)) {
    return "In Chrome or Edge: click the icon to the left of the web address, set Microphone to Allow, then reload this page.";
  }
  if (/Safari\//.test(agent)) {
    return "In Safari: choose Safari → Settings for This Website, set Microphone to Allow, then reload this page.";
  }
  return "Open your browser’s site settings, allow the microphone for this page, then reload.";
}

/**
 * Device check before joining: microphone permission, selector, a live input meter and a
 * "say something" confirmation. Join is the tap that starts the call's audio (spec §6.2).
 */
export function MicCheck({
  joining,
  error,
  onBack,
  onJoin,
}: {
  joining: boolean;
  error: string | null;
  onBack: () => void;
  onJoin: (deviceId: string | undefined) => void;
}) {
  const [permission, setPermission] = useState<Permission>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const preview = useRef<Preview | null>(null);

  const stopPreview = useCallback(() => {
    const current = preview.current;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context.close();
    preview.current = null;
  }, []);

  // Called from taps only: the AudioContext is created before any await so iOS lets it run.
  const startPreview = useCallback(
    async (requestedDeviceId?: string) => {
      stopPreview();
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermission("unavailable");
        return;
      }
      const context = new AudioContext();
      setPermission("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: requestedDeviceId ? { deviceId: { exact: requestedDeviceId } } : true,
        });
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const entry: Preview = { stream, context, frame: 0 };

        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          const value = Math.min(1, Math.sqrt(sum / samples.length) * 6);
          setLevel(Math.round(value * 20) / 20);
          if (value > 0.15) setHeard(true);
          entry.frame = requestAnimationFrame(tick);
        };
        entry.frame = requestAnimationFrame(tick);
        preview.current = entry;

        setPermission("granted");
        setDeviceId(requestedDeviceId ?? stream.getAudioTracks()[0]?.getSettings().deviceId ?? "");
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((device) => device.kind === "audioinput"));
      } catch (caught) {
        void context.close();
        const blocked =
          caught instanceof DOMException && (caught.name === "NotAllowedError" || caught.name === "SecurityError");
        setPermission(blocked ? "denied" : "unavailable");
      }
    },
    [stopPreview],
  );

  useEffect(() => stopPreview, [stopPreview]);

  function join() {
    stopPreview();
    onJoin(deviceId || undefined);
  }

  return (
    <div className="space-y-5">
      {permission === "idle" && (
        <>
          <p className="text-sm text-fg-muted">
            Your browser will ask for microphone access so the interviewer can hear you.
          </p>
          <Button className="w-full sm:w-auto" onClick={() => void startPreview()}>
            Allow microphone
          </Button>
        </>
      )}

      {permission === "requesting" && (
        <p role="status" className="text-sm text-fg-muted">
          Waiting for your browser’s permission…
        </p>
      )}

      {permission === "granted" && (
        <>
          {devices.length > 1 && (
            <div className="space-y-1.5">
              <label htmlFor="mic-device" className="block text-xs font-medium text-fg">
                Microphone
              </label>
              <Select
                id="mic-device"
                value={deviceId}
                onChange={(event) => {
                  setHeard(false);
                  void startPreview(event.target.value);
                }}
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm text-fg">
              {heard ? "We can hear you." : "Say something. The bar should move when you speak."}
            </p>
            <div
              role="meter"
              aria-label="Microphone level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level * 100)}
              className="h-2 overflow-hidden rounded-full bg-surface-sunken"
            >
              <div className="h-full rounded-full bg-brand transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
            </div>
          </div>
        </>
      )}

      {permission === "denied" && (
        <div role="alert" className="space-y-2 rounded-md bg-live-050 px-4 py-3">
          <p className="text-sm font-medium text-live-600">Microphone access is blocked</p>
          <p className="text-[13px] text-fg">{microphoneHelp()}</p>
          <Button variant="secondary" size="sm" onClick={() => void startPreview()}>
            Try again
          </Button>
        </div>
      )}

      {permission === "unavailable" && (
        <div role="alert" className="space-y-2 rounded-md bg-warn-050 px-4 py-3">
          <p className="text-sm font-medium text-warn-700">No microphone found</p>
          <p className="text-[13px] text-fg">Connect a microphone or headset, or open this link on your phone.</p>
          <Button variant="secondary" size="sm" onClick={() => void startPreview()}>
            Try again
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-sm bg-live-050 px-3 py-2 text-[13px] text-live-600">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={joining}>
          Back
        </Button>
        <Button onClick={join} disabled={permission !== "granted" || joining}>
          {joining ? "Joining…" : "Join interview"}
        </Button>
      </div>
    </div>
  );
}
