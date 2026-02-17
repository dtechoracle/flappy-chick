/**
 * User Session Management with Redis
 * Stores user sessions server-side (NOT in localStorage)
 */

import { getRedisClient } from "./redisClient";

const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days

function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function getSessionKey(token: string): string {
  return `user:session:${token}`;
}

export interface UserSession {
  userId: string;
  username: string;
  createdAt: number;
  lastActive: number;
  expires: number;
}

/**
 * Create a new user session
 */
export async function createSession(userId: string, username: string): Promise<string> {
  const token = generateSessionToken();
  const redis = getRedisClient();

  const session: UserSession = {
    userId,
    username,
    createdAt: Date.now(),
    lastActive: Date.now(),
    expires: Date.now() + SESSION_DURATION * 1000,
  };

  if (redis) {
    const sessionKey = getSessionKey(token);
    await redis.setEx(
      sessionKey,
      SESSION_DURATION,
      JSON.stringify(session)
    );
  }

  return token;
}

/**
 * Get session data from token
 */
export async function getSession(token: string): Promise<UserSession | null> {
  if (!token) return null;

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const sessionKey = getSessionKey(token);
    const sessionData = await redis.get(sessionKey);

    if (!sessionData) return null;

    const session = JSON.parse(sessionData) as UserSession;

    // Check if expired
    if (Date.now() > session.expires) {
      await redis.del(sessionKey);
      return null;
    }

    // Update last active time (refresh session)
    session.lastActive = Date.now();
    await redis.setEx(
      sessionKey,
      SESSION_DURATION,
      JSON.stringify(session)
    );

    return session;
  } catch (error) {
    console.error("Redis error getting session:", error);
    return null;
  }
}

/**
 * Delete a session
 */
export async function deleteSession(token: string): Promise<void> {
  if (!token) return;

  const redis = getRedisClient();
  if (!redis) return;

  try {
    const sessionKey = getSessionKey(token);
    await redis.del(sessionKey);
  } catch (error) {
    console.error("Redis error deleting session:", error);
  }
}

/**
 * Update username in existing session
 */
export async function updateSessionUsername(
  token: string,
  username: string
): Promise<boolean> {
  const session = await getSession(token);
  if (!session) return false;

  session.username = username;
  session.lastActive = Date.now();

  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const sessionKey = getSessionKey(token);
    await redis.setEx(
      sessionKey,
      SESSION_DURATION,
      JSON.stringify(session)
    );
    return true;
  } catch (error) {
    console.error("Redis error updating session:", error);
    return false;
  }
}
