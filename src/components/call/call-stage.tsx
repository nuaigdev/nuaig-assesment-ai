"use client";

import {
  RoomAudioRenderer,
  useAudioPlayback,
  useConnectionQualityIndicator,
  useIsSpeaking,
  useLocalParticipant,
  useMediaDeviceSelect,
  useParticipants,
  useRoomContext,
  useTrackVolume,
} from "@livekit/components-react";
import { ConnectionQuality, Track, supportsAudioOutputSelection, type Participant } from "livekit-client";
import {
  MessageSquarePlus,
  MessageSquareText,
  Mic,
  MicOff,
  Settings,
  Signal,
  SignalLow,
  SignalMedium,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LocalTime } from "@/components/ui/local-time";
import { NuaigMark } from "@/components/ui/nuaig-mark";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export type CallRole = "interviewee" | "steward" | "observer";
type RailTab = "transcript" | "steer" | "people";

const INTERVIEWEE = "interviewee";
const AGENT = "agent";

const RAIL_TABS: Record<CallRole, RailTab[]> = {
  interviewee: ["people"],
  observer: ["transcript", "people"],
  steward: ["transcript", "steer", "people"],
};
const RAIL_LABELS: Record<RailTab, string> = { transcript: "Transcript", steer: "Steer", people: "People" };

/**
 * The call stage (spec §12): dark, avatar-led tiles for the interviewee and the agent only,
 * a floating control bar, and a right rail. Must render inside LiveKit's RoomContext.
 */
export function CallStage({
  title,
  role,
  canEnd,
  intervieweeName,
  reconnecting,
  onLeave,
  onEnd,
}: {
  title: string;
  role: CallRole;
  canEnd: boolean;
  intervieweeName: string | null;
  reconnecting: boolean;
  onLeave: () => void;
  onEnd?: () => Promise<void>;
}) {
  const participants = useParticipants();
  const interviewee = participants.find((participant) => participant.identity === INTERVIEWEE);
  const agent = participants.find((participant) => participant.identity === AGENT);
  const toast = useToast();

  const [rail, setRail] = useState<RailTab | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const isInterviewee = role === "interviewee";

  async function endInterview() {
    if (!onEnd) return;
    setEnding(true);
    try {
      await onEnd();
    } catch (error) {
      setEnding(false);
      setConfirmEnd(false);
      toast(error instanceof Error ? error.message : "Couldn’t end the interview.", { tone: "error" });
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-stage text-stage-fg">
      <CallTopBar title={title} startedAt={interviewee?.joinedAt} />

      {reconnecting && (
        <p role="status" className="mx-auto rounded-full bg-warn-050 px-3 py-1 text-xs font-medium text-warn-700">
          Reconnecting…
        </p>
      )}

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* On phones only one tile shows: the agent for the interviewee, the interviewee for staff (§12.6). */}
          <div className="flex flex-1 items-center justify-center gap-6 px-4 pb-24 sm:pb-4">
            <ParticipantTile
              participant={agent}
              kind="agent"
              name="NuAIg interviewer"
              waitingText="Joining shortly"
              className={isInterviewee ? undefined : "hidden sm:flex"}
            />
            <ParticipantTile
              participant={interviewee}
              kind="interviewee"
              name={interviewee?.name || intervieweeName || "Interviewee"}
              waitingText="Waiting to join"
              className={isInterviewee ? "hidden sm:flex" : undefined}
            />
          </div>
          <ControlBar
            role={role}
            canEnd={canEnd}
            rail={rail}
            onToggleRail={(tab) => setRail((current) => (current === tab ? null : tab))}
            onSettings={() => setSettingsOpen(true)}
            onLeave={onLeave}
            onEnd={() => setConfirmEnd(true)}
          />
        </main>

        {rail && (
          <CallRail tab={rail} tabs={RAIL_TABS[role]} onTab={setRail} onClose={() => setRail(null)} />
        )}
      </div>

      <RoomAudioRenderer />
      <AudioUnlockPrompt />

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Audio settings"
        footer={<Button onClick={() => setSettingsOpen(false)}>Done</Button>}
      >
        {settingsOpen && <DeviceSettings canSpeak={isInterviewee} />}
      </Dialog>

      {canEnd && (
        <Dialog
          open={confirmEnd}
          onClose={() => !ending && setConfirmEnd(false)}
          title="End the interview?"
          description="This ends the call for everyone. The interviewee can’t rejoin afterwards."
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmEnd(false)} disabled={ending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void endInterview()} disabled={ending}>
                {ending ? "Ending…" : "End interview"}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}

// Top bar ---------------------------------------------------------------------------------------

function CallTopBar({ title, startedAt }: { title: string; startedAt?: Date }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-stage-fg">
        <span aria-hidden className="size-2 rounded-full bg-live animate-live-pulse motion-reduce:animate-none" />
        <span aria-hidden>REC</span>
        <span className="sr-only">This call is recorded.</span>
      </span>
      <h1 className="min-w-0 truncate text-[15px] font-medium">{title}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-3 text-[13px] text-stage-muted">
        <CallTimer startedAt={startedAt} />
        <ConnectionIndicator />
      </div>
    </header>
  );
}

let tickerNow = 0;
let tickerInterval: ReturnType<typeof setInterval> | undefined;
const tickerListeners = new Set<() => void>();

function subscribeTicker(listener: () => void) {
  tickerListeners.add(listener);
  if (!tickerInterval) {
    tickerNow = Date.now();
    tickerInterval = setInterval(() => {
      tickerNow = Date.now();
      tickerListeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    tickerListeners.delete(listener);
    if (tickerListeners.size === 0 && tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = undefined;
    }
  };
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Call duration, counted from when the interviewee joined. */
function CallTimer({ startedAt }: { startedAt?: Date }) {
  const now = useSyncExternalStore(
    subscribeTicker,
    () => tickerNow,
    () => 0,
  );
  return (
    <span className="font-medium tabular-nums" aria-label="Call duration">
      {startedAt && now ? formatElapsed(now - startedAt.getTime()) : "00:00:00"}
    </span>
  );
}

const QUALITY: Record<ConnectionQuality, { label: string; icon: typeof Signal }> = {
  [ConnectionQuality.Excellent]: { label: "Excellent", icon: Signal },
  [ConnectionQuality.Good]: { label: "Good", icon: SignalMedium },
  [ConnectionQuality.Poor]: { label: "Poor", icon: SignalLow },
  [ConnectionQuality.Lost]: { label: "Lost", icon: WifiOff },
  [ConnectionQuality.Unknown]: { label: "Checking", icon: SignalMedium },
};

function ConnectionIndicator() {
  const { localParticipant } = useLocalParticipant();
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const { label, icon: Icon } = QUALITY[quality] ?? QUALITY[ConnectionQuality.Unknown];
  const poor = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost;
  return (
    <span title={`Connection: ${label}`} className={cn("inline-flex", poor && "text-warn")}>
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">Connection: {label}</span>
    </span>
  );
}

// Tiles ------------------------------------------------------------------------------------------

type TileProps = {
  kind: "agent" | "interviewee";
  name: string;
  waitingText: string;
  className?: string;
};

/**
 * A stage tile. LiveKit's participant hooks throw without a participant, so the empty state
 * is a separate hook-free component rather than a hook call with `undefined`.
 */
function ParticipantTile({ participant, ...props }: TileProps & { participant: Participant | undefined }) {
  return participant ? <PresentTile participant={participant} {...props} /> : <TileFrame {...props} waiting />;
}

function PresentTile({ participant, ...props }: TileProps & { participant: Participant }) {
  const speaking = useIsSpeaking(participant);
  const publication = participant.getTrackPublication(Track.Source.Microphone);
  const muted = !publication || publication.isMuted;

  return (
    <TileFrame
      {...props}
      muted={muted}
      status={muted ? "Muted" : speaking ? "Speaking" : " "}
      ring={
        speaking && publication?.track ? (
          <SpeakingRing participant={participant} publication={publication} />
        ) : (
          <span aria-hidden className="absolute -inset-2 rounded-full border-2 border-transparent" />
        )
      }
    />
  );
}

/** The speaking ring: the one piece of ambient motion (§12.2). Static under reduced motion. */
function SpeakingRing({
  participant,
  publication,
}: {
  participant: Participant;
  publication: NonNullable<ReturnType<Participant["getTrackPublication"]>>;
}) {
  const volume = useTrackVolume({ participant, publication, source: Track.Source.Microphone });
  const level = Math.min(1, volume * 4);
  return (
    <span
      aria-hidden
      style={{ "--level": level } as CSSProperties}
      className="absolute -inset-2 rounded-full border-2 border-brand transition-[scale] duration-150 ease-out scale-[calc(1_+_var(--level)_*_0.08)] motion-reduce:scale-100"
    />
  );
}

function TileFrame({
  kind,
  name,
  waitingText,
  className,
  waiting = false,
  muted = false,
  status,
  ring,
}: TileProps & { waiting?: boolean; muted?: boolean; status?: string; ring?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-56 w-full max-w-sm min-w-0 flex-col items-center justify-center gap-5 rounded-lg bg-stage-raised px-6 sm:h-64 sm:min-w-60",
        waiting && "opacity-70",
        className,
      )}
    >
      <div className="relative">
        {ring}
        <div className="flex size-24 items-center justify-center rounded-full bg-stage-hover text-2xl font-semibold text-stage-fg">
          {kind === "agent" ? <NuaigMark inverted className="size-12" /> : initials(name, name)}
        </div>
        {muted && (
          <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-stage text-stage-muted ring-2 ring-stage-raised">
            <MicOff aria-hidden className="size-3.5" />
          </span>
        )}
      </div>
      <div className="text-center">
        <p className="text-[15px] font-medium text-stage-fg">{name}</p>
        <p className="mt-0.5 text-[13px] text-stage-muted" aria-live="polite">
          {waiting ? waitingText : status}
        </p>
      </div>
    </div>
  );
}

// Control bar ------------------------------------------------------------------------------------

function ControlButton({
  label,
  pressed,
  onClick,
  alert = false,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-out [&_svg]:size-5",
        alert
          ? "bg-live-600 text-white hover:brightness-110"
          : pressed
            ? "bg-brand-700 text-white"
            : "text-stage-fg hover:bg-stage-hover",
      )}
    >
      {children}
    </button>
  );
}

function ControlBar({
  role,
  canEnd,
  rail,
  onToggleRail,
  onSettings,
  onLeave,
  onEnd,
}: {
  role: CallRole;
  canEnd: boolean;
  rail: RailTab | null;
  onToggleRail: (tab: RailTab) => void;
  onSettings: () => void;
  onLeave: () => void;
  onEnd: () => void;
}) {
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center border-t border-stage-border bg-stage-raised px-3 py-3 sm:static sm:mb-6 sm:border-0 sm:bg-transparent sm:py-0">
      <div
        role="toolbar"
        aria-label="Call controls"
        className="flex items-center gap-1.5 sm:rounded-lg sm:border sm:border-stage-border sm:bg-stage-raised sm:px-3 sm:py-2 sm:shadow-float"
      >
        {role === "interviewee" && (
          <ControlButton
            label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
            alert={!isMicrophoneEnabled}
            onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          >
            {isMicrophoneEnabled ? <Mic aria-hidden /> : <MicOff aria-hidden />}
          </ControlButton>
        )}
        <ControlButton label="People" pressed={rail === "people"} onClick={() => onToggleRail("people")}>
          <Users aria-hidden />
        </ControlButton>
        {role !== "interviewee" && (
          <ControlButton label="Transcript" pressed={rail === "transcript"} onClick={() => onToggleRail("transcript")}>
            <MessageSquareText aria-hidden />
          </ControlButton>
        )}
        {role === "steward" && (
          <ControlButton label="Steer the agent" pressed={rail === "steer"} onClick={() => onToggleRail("steer")}>
            <MessageSquarePlus aria-hidden />
          </ControlButton>
        )}
        <ControlButton label="Audio settings" onClick={onSettings}>
          <Settings aria-hidden />
        </ControlButton>
        <span aria-hidden className="mx-1 h-6 w-px bg-stage-border" />
        <button
          type="button"
          onClick={onLeave}
          className="h-11 shrink-0 rounded-full bg-live-600 px-5 text-sm font-medium text-white transition-[filter] duration-150 hover:brightness-110"
        >
          Leave
        </button>
        {canEnd && (
          <button
            type="button"
            onClick={onEnd}
            className="h-11 shrink-0 rounded-full border border-live-600 px-4 text-sm font-medium text-stage-fg transition-colors duration-150 hover:bg-live-600"
          >
            End<span className="hidden sm:inline"> interview</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Right rail ----------------------------------------------------------------------------------------

function CallRail({
  tab,
  tabs,
  onTab,
  onClose,
}: {
  tab: RailTab;
  tabs: RailTab[];
  onTab: (tab: RailTab) => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Call panel"
      className="absolute inset-0 z-30 flex flex-col bg-stage-raised sm:left-auto sm:w-[360px] sm:border-l sm:border-stage-border xl:static"
    >
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-stage-border px-2">
        <div role="tablist" aria-label="Call panel" className="flex flex-1 gap-1">
          {tabs.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={option === tab}
              onClick={() => onTab(option)}
              className={cn(
                "h-9 rounded-sm px-3 text-sm font-medium transition-colors duration-150",
                option === tab ? "bg-stage-hover text-stage-fg" : "text-stage-muted hover:text-stage-fg",
              )}
            >
              {RAIL_LABELS[option]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="flex size-9 items-center justify-center rounded-sm text-stage-muted hover:bg-stage-hover hover:text-stage-fg"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div role="tabpanel" aria-label={RAIL_LABELS[tab]} className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "people" && <PeopleList />}
        {tab === "transcript" && (
          <p className="text-[13px] text-stage-muted">
            The live transcript appears here once the AI interviewer is connected (Phase 3).
          </p>
        )}
        {tab === "steer" && (
          <p className="text-[13px] text-stage-muted">Steering the agent arrives in Phase 6.</p>
        )}
      </div>
    </aside>
  );
}

/** Everyone on the call, grouped. The interviewee sees this list in full: listeners are never hidden. */
function PeopleList() {
  const participants = useParticipants();
  const groups = [
    { title: "Interviewee", people: participants.filter((p) => p.identity === INTERVIEWEE) },
    { title: "AI interviewer", people: participants.filter((p) => p.identity === AGENT) },
    { title: "NuAIg team", people: participants.filter((p) => p.identity.startsWith("staff-")) },
  ];

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h3 className="text-xs font-medium text-stage-muted">{group.title}</h3>
          {group.people.length === 0 ? (
            <p className="mt-2 text-[13px] text-stage-muted">Not on the call</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {group.people.map((participant) => (
                <PersonRow key={participant.identity} participant={participant} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function PersonRow({ participant }: { participant: Participant }) {
  const speaking = useIsSpeaking(participant);
  const role = participant.attributes.role;
  const name = participant.name || (participant.identity === AGENT ? "NuAIg interviewer" : "Participant");

  return (
    <li className="flex items-center gap-3 rounded-sm px-2 py-2">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full bg-stage-hover text-[11px] font-semibold ring-2",
          speaking ? "ring-brand" : "ring-transparent",
        )}
      >
        {participant.identity === AGENT ? <NuaigMark inverted className="size-4" /> : initials(name, name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-stage-fg">
          {name}
          {participant.isLocal && <span className="text-stage-muted"> (you)</span>}
        </p>
        {participant.joinedAt && (
          <p className="text-xs text-stage-muted">
            Joined <LocalTime iso={participant.joinedAt.toISOString()} format="time" />
          </p>
        )}
      </div>
      {(role === "steward" || role === "observer") && (
        <span className="shrink-0 rounded-sm bg-stage-hover px-2 py-0.5 text-xs font-medium text-stage-fg">
          {role === "steward" ? "Steward" : "Observing"}
        </span>
      )}
    </li>
  );
}

// Audio -------------------------------------------------------------------------------------------------

/** Browsers can still block playback; this gives the user a tap to unblock it. */
function AudioUnlockPrompt() {
  const room = useRoomContext();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  if (canPlayAudio) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-stage/80 px-4">
      <Button onClick={() => void startAudio()}>Tap to turn on sound</Button>
    </div>
  );
}

function DeviceSettings({ canSpeak }: { canSpeak: boolean }) {
  const room = useRoomContext();
  const microphones = useMediaDeviceSelect({ kind: "audioinput", room });
  const speakers = useMediaDeviceSelect({ kind: "audiooutput", room });
  const canChooseSpeaker = supportsAudioOutputSelection();

  return (
    <div className="space-y-4">
      {canSpeak && (
        <div className="space-y-1.5">
          <label htmlFor="call-microphone" className="block text-xs font-medium text-fg">
            Microphone
          </label>
          <Select
            id="call-microphone"
            value={microphones.activeDeviceId}
            onChange={(event) => void microphones.setActiveMediaDevice(event.target.value)}
          >
            {microphones.devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </Select>
        </div>
      )}
      {canChooseSpeaker ? (
        <div className="space-y-1.5">
          <label htmlFor="call-speaker" className="block text-xs font-medium text-fg">
            Speaker
          </label>
          <Select
            id="call-speaker"
            value={speakers.activeDeviceId}
            onChange={(event) => void speakers.setActiveMediaDevice(event.target.value)}
          >
            {speakers.devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Speaker ${index + 1}`}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-[13px] text-fg-muted">
          This browser uses your system’s audio output. Change it in your device’s sound settings.
        </p>
      )}
    </div>
  );
}
