// npm run setup:engine — creates (or updates) the ElevenLabs Speech Engine this worker drives.
// Run it again whenever the worker's public URL or the voice changes.
import { ElevenLabs, ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { loadSetupEnv } from "./env.js";

const env = loadSetupEnv();
const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });

const config = {
  name: "NuAIg interviewer",
  speechEngine: { wsUrl: env.BRAIN_PUBLIC_URL },
  asr: { userInputAudioFormat: ElevenLabs.AsrInputFormat.Pcm16000 },
  tts: {
    agentOutputAudioFormat: ElevenLabs.TtsOutputFormat.Pcm24000,
    ...(env.ELEVENLABS_VOICE_ID ? { voiceId: env.ELEVENLABS_VOICE_ID } : {}),
  },
  // Lets the worker set the opening line per interview.
  overrides: { firstMessage: true },
};

if (env.ELEVENLABS_SPEECH_ENGINE_ID) {
  await client.speechEngine.update(env.ELEVENLABS_SPEECH_ENGINE_ID, config);
  console.log(`Updated ${env.ELEVENLABS_SPEECH_ENGINE_ID}: brain at ${env.BRAIN_PUBLIC_URL}`);
} else {
  const engine = await client.speechEngine.create(config);
  console.log(`Created Speech Engine ${engine.engineId}. Set ELEVENLABS_SPEECH_ENGINE_ID=${engine.engineId}`);
}
