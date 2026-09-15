// App-facing names for the generated schema types. database.types.ts is overwritten by
// `pnpm db:types`; import from here instead of from it.
import type { Enums, Tables } from "./database.types";

export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";

/** A NuAIg staff member (row in `users`). */
export type AppUser = Tables<"users">;

export type UserRole = Enums<"user_role">;
export type InterviewStatus = Enums<"interview_status">;
export type ParticipantRole = Enums<"participant_role">;
export type SpeakerRole = Enums<"speaker_role">;
export type EndReason = Enums<"end_reason">;
