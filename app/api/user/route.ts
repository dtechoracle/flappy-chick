/**
 * User Data API
 * GET /api/user - Get user coins and inventory
 * PUT /api/user - Update user coins and inventory
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "flappy_session";

async function getUserFromSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie) return null;

  const session = await getSession(sessionCookie.value);
  if (!session) return null;

  return session;
}

/**
 * GET - Get user data (coins and inventory)
 */
export async function GET() {
  try {
    const session = await getUserFromSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        coins: true,
        inventory: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Parse inventory JSON
    const inventory = JSON.parse(user.inventory);

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        coins: user.coins,
        inventory,
      },
    });
  } catch (error) {
    console.error("User GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update user data (coins and/or inventory)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getUserFromSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { coins, inventory } = body;

    const updateData: any = {};

    if (typeof coins === "number") {
      updateData.coins = coins;
    }

    if (inventory && typeof inventory === "object") {
      updateData.inventory = JSON.stringify(inventory);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No data to update" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        coins: true,
        inventory: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        coins: user.coins,
        inventory: JSON.parse(user.inventory),
      },
    });
  } catch (error) {
    console.error("User PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user data" },
      { status: 500 }
    );
  }
}
