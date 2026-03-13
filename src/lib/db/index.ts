import "server-only";

import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Use Neon HTTP driver for neon.tech URLs, standard pg for local Postgres.
// This lets contributors run a local Postgres via docker-compose without Neon.
const url = env.DATABASE_URL;
export const db = url.includes("neon.tech")
  ? drizzleNeon(url, { schema })
  : drizzlePg(url, { schema });
