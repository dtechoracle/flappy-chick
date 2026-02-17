import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const scores = await prisma.score.findMany({
            orderBy: {
                score: 'desc'
            },
            take: 100,
            include: {
                user: {
                    select: {
                        username: true
                    }
                }
            }
        });

        // Transform to match old format
        const formattedScores = scores.map(s => ({
            id: s.id,
            username: s.user.username,
            score: s.score,
            timestamp: s.createdAt.toISOString()
        }));

        return NextResponse.json({ scores: formattedScores });
    } catch (error) {
        console.error('Error fetching scores:', error);
        return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        // Delete all scores (users will remain)
        await prisma.score.deleteMany({});
        
        return NextResponse.json({ message: 'All scores deleted' });
    } catch (error) {
        console.error('Error deleting scores:', error);
        return NextResponse.json({ error: 'Failed to delete scores' }, { status: 500 });
    }
}
