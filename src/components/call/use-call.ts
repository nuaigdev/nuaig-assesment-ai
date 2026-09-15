"use client";

import { DisconnectReason, Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

export type CallEndReason = "ended" | "left" | "removed" | "duplicate" | "lost";

export type CallPhase =
  | { name: "idle" }
  | { name: "connecting" }
  | { name: "connected" }
  | { name: "reconnecting" }
  | { name: "ended"; reason: CallEndReason }
  | { name: "failed"; message: string };

type TokenResponse = { serverUrl: string; participantToken: string };

async function postJson(url: string, body?: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return data;
}

/** Presence reports survive brief blips (LiveKit not yet showing the join, upstream timeouts). */
async function reportPresence(url: string, present: boolean, attempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await postJson(url, { present });
      return;
    } catch {
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

function endReasonFor(reason?: DisconnectReason): CallEndReason {
  switch (reason) {
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return "ended";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "removed";
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "duplicate";
    default:
      return "lost";
  }
}

function joinErrorMessage(error: unknown): string {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "Microphone access was blocked. Allow the microphone for this site, then try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found. Connect one and try again.";
  }
  return error instanceof Error && error.message ? error.message : "Couldn’t join the call. Please try again.";
}

/**
 * Connects to an interview's LiveKit room. `join()` must be called from a user's tap: it
 * unlocks audio playback before any await, which iOS Safari requires (spec §6.2).
 * Presence is reported to the server after connecting and when leaving or closing the tab.
 */
export function useCall({
  tokenUrl,
  presenceUrl,
  publishMicrophone,
}: {
  tokenUrl: string;
  presenceUrl: string;
  publishMicrophone: boolean;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [phase, setPhase] = useState<CallPhase>({ name: "idle" });
  const leavingRef = useRef(false);
  const roomRef = useRef<Room | null>(null);

  const join = useCallback(
    (microphoneDeviceId?: string) => {
      const next = new Room({
        audioCaptureDefaults: {
          deviceId: microphoneDeviceId,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      void next.startAudio();
      leavingRef.current = false;
      setPhase({ name: "connecting" });

      next
        .on(RoomEvent.Reconnecting, () => setPhase({ name: "reconnecting" }))
        .on(RoomEvent.Reconnected, () => setPhase({ name: "connected" }))
        .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          if (leavingRef.current) return;
          roomRef.current = null;
          setRoom(null);
          setPhase({ name: "ended", reason: endReasonFor(reason) });
        });

      void (async () => {
        try {
          const { serverUrl, participantToken } = (await postJson(tokenUrl)) as TokenResponse;
          await next.connect(serverUrl, participantToken);
          if (publishMicrophone) {
            await next.localParticipant.setMicrophoneEnabled(true);
          }
          roomRef.current = next;
          setRoom(next);
          setPhase({ name: "connected" });
          // The call works regardless; this records join times and moves the interview to live.
          void reportPresence(presenceUrl, true);
        } catch (error) {
          leavingRef.current = true;
          await next.disconnect();
          setPhase({ name: "failed", message: joinErrorMessage(error) });
        }
      })();
    },
    [tokenUrl, presenceUrl, publishMicrophone],
  );

  const leave = useCallback(async () => {
    const current = roomRef.current;
    if (!current) return;
    leavingRef.current = true;
    roomRef.current = null;
    await current.disconnect();
    setRoom(null);
    setPhase({ name: "ended", reason: "left" });
    await reportPresence(presenceUrl, false);
  }, [presenceUrl]);

  const reset = useCallback(() => setPhase({ name: "idle" }), []);

  // While connected: report leaving if the tab closes, and keep phones from sleeping mid-call.
  useEffect(() => {
    if (!room) return;

    const onPageHide = () => {
      navigator.sendBeacon?.(
        presenceUrl,
        new Blob([JSON.stringify({ present: false })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", onPageHide);

    let lock: WakeLockSentinel | null = null;
    let active = true;
    const requestWakeLock = async () => {
      if (!active || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Not supported or not allowed; the call still works.
      }
    };
    const onVisibilityChange = () => void requestWakeLock();
    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void lock?.release().catch(() => undefined);
    };
  }, [room, presenceUrl]);

  // Leaving the page without pressing Leave still disconnects cleanly.
  useEffect(() => {
    return () => {
      leavingRef.current = true;
      void roomRef.current?.disconnect();
    };
  }, []);

  return { room, phase, join, leave, reset };
}
