import "server-only";

import { parseEnv, serverEnvSchema } from "./schema";

export const env = parseEnv(serverEnvSchema, process.env);
