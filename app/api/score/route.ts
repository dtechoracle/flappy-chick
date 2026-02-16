import { NextRequest, NextResponse } from 'next/server';
import { saveScore } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, score } = body;

        if (!username || typeof score !== 'number') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const newScore = saveScore(username, score);
        return NextResponse.json(newScore);
    } catch (error) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
