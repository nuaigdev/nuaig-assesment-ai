import { log } from "./log.js";

/** What the app tells the worker about an interview when a session starts. */
export type SessionContext = {
  title: string;
  department: string;
  organizationName: string | null;
  intervieweeName: string | null;
  openingLine: string;
};

export type TranscriptMessage = { role: "user" | "agent"; content: string };

export type WorkerEvent =
  | { type: "user_transcript"; text: string }
  | { type: "agent_response"; text: string }
  | { type: "agent_correction"; text: string }
  | { type: "agent_left" }
  | { type: "failed"; message: string };

/**
 * The worker's only link to the database: the app's internal /api/agent/* routes, authenticated
 * with the shared AGENT_WORKER_SECRET (spec §10.1).
 */
export class AppApi {
  constructor(
    private readonly baseUrl: string,
    private readonly secret: string,
  ) {}

  getSession(interviewId: string): Promise<SessionContext> {
    return this.post("/api/agent/session", { interviewId });
  }

  registerConversation(interviewId: string, conversationId: string): Promise<SessionContext> {
    return this.post("/api/agent/session", { interviewId, conversationId });
  }

  /** Latency-sensitive: the agent is silent until this returns. */
  nextTurn(conversationId: string, transcript: TranscriptMessage[]): Promise<{ text: string }> {
    return this.post("/api/agent/turn", { conversationId, transcript }, 8_000);
  }

  sendEvents(interviewId: string, events: WorkerEvent[]): Promise<void> {
    return this.post("/api/agent/events", { interviewId, events });
  }

  private async post<T>(path: string, body: unknown, timeoutMs = 10_000): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${path} failed (${response.status}): ${text.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

async function withRetry(operation: () => Promise<void>, attempts = 3): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

/**
 * Delivers events to the app one at a time, in order, with retries. Transcript order matters,
 * so events are never sent concurrently.
 */
export class EventQueue {
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly api: AppApi,
    private readonly interviewId: string,
  ) {}

  push(event: WorkerEvent): void {
    this.chain = this.chain
      .then(() => withRetry(() => this.api.sendEvents(this.interviewId, [event])))
      .catch((error: unknown) => {
        log.error("event delivery failed", { interviewId: this.interviewId, type: event.type, error: String(error) });
      });
  }

  flush(): Promise<void> {
    return this.chain;
  }
}
