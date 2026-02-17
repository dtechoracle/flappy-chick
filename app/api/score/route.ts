import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, score } = body;

        if (!username || typeof score !== 'number') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Find or create user
        let user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            user = await prisma.user.create({
                data: { username }
            });
        }

        // Create score record
        const newScore = await prisma.score.create({
            data: {
                score,
                userId: user.id
            },
            include: {
                user: {
                    select: {
                        username: true
                    }
                }
            }
        });

        return NextResponse.json({
            id: newScore.id,
            username: newScore.user.username,
            score: newScore.score,
            timestamp: newScore.createdAt.toISOString()
        });
    } catch (error) {
        console.error('Error saving score:', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
