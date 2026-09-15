/**
 * Phase 3 uses fixed replies so the voice pipeline can be tuned without an LLM in the loop
 * (spec §14, Phase 3). Phase 4 replaces this with template-driven questions from Claude.
 */
const SCRIPT = [
  "Hello, and thanks for joining. I'm the NuAIg interviewer. To start, could you tell me a little about your role and your team?",
  "Thank you. Walk me through a typical week in your department. What takes up most of your time?",
  "That's helpful. Where do things slow down, or need the most manual work?",
  "Understood. Which tools or systems do you rely on for that today?",
  "Thank you, that's everything for this test conversation. A NuAIg team member will end the call shortly.",
] as const;

/** Spoken as soon as the agent joins, before the interviewee says anything. */
export function openingLine(): string {
  return SCRIPT[0];
}

/** The reply after the interviewee's n-th turn (1-based). The closing line repeats once the script runs out. */
export function scriptedReply(userTurn: number): string {
  return SCRIPT[Math.min(Math.max(userTurn, 1), SCRIPT.length - 1)];
}
