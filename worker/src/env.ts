import { z } from "zod";

try {
  process.loadEnvFile(".env");
} catch {
  // In production the host provides the variables.
}

const workerSchema = z.object({
  LIVEKIT_URL: z.string().regex(/^wss?:\/\//, "must be the wss:// URL of the LiveKit project"),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_SPEECH_ENGINE_ID: z.string().startsWith("seng_", "run `npm run setup:engine` and set the id it prints"),
  /** The Next.js app, e.g. https://nuaig-assesment-ai.vercel.app */
  APP_URL: z.url(),
  /** Same value as the app's AGENT_WORKER_SECRET. */
  AGENT_WORKER_SECRET: z.string().min(32),
  /** Public port: the brain WebSocket (/brain) and /healthz. */
  PORT: z.coerce.number().int().positive().default(8080),
  /** LiveKit agent server's internal health port. */
  HEALTH_PORT: z.coerce.number().int().positive().default(8081),
});

const setupSchema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_SPEECH_ENGINE_ID: z.string().startsWith("seng_").optional(),
  /** Where ElevenLabs reaches this worker's brain, e.g. wss://nuaig-worker.up.railway.app/brain */
  BRAIN_PUBLIC_URL: z.string().regex(/^wss:\/\/.+\/brain$/, "must be this worker's public wss://…/brain URL"),
  /** DECISION NEEDED (spec §18.7): the agent's voice. Omit to keep ElevenLabs' default. */
  ELEVENLABS_VOICE_ID: z.string().min(1).optional(),
});

export type WorkerEnv = z.infer<typeof workerSchema>;
export type SetupEnv = z.infer<typeof setupSchema>;

function parse<T extends z.ZodType>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid worker configuration (see worker/.env.example):\n${problems}`);
  }
  return result.data;
}

export const loadWorkerEnv = () => parse(workerSchema);
export const loadSetupEnv = () => parse(setupSchema);
