import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;

function resolveRedisUrl(): string | null {
  return process.env.REDIS_URL ?? process.env.KV_REST_API_REDIS_URL ?? null;
}

export function getRedisClient(): RedisClientType | null {
  if (client) return client;
  const url = resolveRedisUrl();
  if (!url) {
    console.warn(
      "[redis] REDIS_URL or KV_REST_API_REDIS_URL is not set; falling back to no-op limits/logging."
    );
    return null;
  }
  client = createClient({ url });
  client.on("error", (err) => {
    console.error("[redis] client error:", err);
  });
  // Connect in background; commands will be queued until ready
  client.connect().catch((err) => {
    console.error("[redis] failed to connect:", err);
  });
  return client;
}
