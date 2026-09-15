// Server boot: validate configuration before serving any request (spec §15).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseEnv, serverEnvSchema } = await import("./lib/env/schema");
    parseEnv(serverEnvSchema, process.env);
  }
}
