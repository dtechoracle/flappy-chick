/**
 * User Session API
 * GET /api/auth/session - Get current session
 * POST /api/auth/session - Create or update session
 * DELETE /api/auth/session - Logout
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, deleteSession, updateSessionUsername } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "flappy_session";
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days

/**
 * GET - Get current session
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);

    if (!sessionCookie) {
      return NextResponse.json({ 
        authenticated: false,
        username: null 
      });
    }

    const session = await getSession(sessionCookie.value);

    if (!session) {
      return NextResponse.json({ 
        authenticated: false,
        username: null 
      });
    }

    return NextResponse.json({ 
      authenticated: true,
      username: session.username,
      userId: session.userId
    });
  } catch (error) {
    console.error("Session GET error:", error);
    return NextResponse.json({ 
      authenticated: false,
      username: null 
    });
  }
}

/**
 * POST - Create or update session with username
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();

    // Check for existing session
    const cookieStore = await cookies();
    const existingCookie = cookieStore.get(SESSION_COOKIE);

    if (existingCookie) {
      const existingSession = await getSession(existingCookie.value);
      
      if (existingSession) {
        // Update existing session
        const updated = await updateSessionUsername(existingCookie.value, trimmedUsername);
        
        if (updated) {
          return NextResponse.json({
            success: true,
            username: trimmedUsername,
            userId: existingSession.userId
          });
        }
      }
    }

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { username: trimmedUsername }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { username: trimmedUsername }
      });
    }

    // Create new session
    const token = await createSession(user.id, user.username);

    const response = NextResponse.json({
      success: true,
      username: user.username,
      userId: user.id
    });

    // Set httpOnly cookie
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_DURATION,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Session POST error:", error);
    return NextResponse.json(
      { success: false, error: "Session creation failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Logout (delete session)
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);

    if (sessionCookie) {
      await deleteSession(sessionCookie.value);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE);
    
    return response;
  } catch (error) {
    console.error("Session DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
