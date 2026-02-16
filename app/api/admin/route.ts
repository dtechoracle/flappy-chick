import { NextResponse } from 'next/server';
import { getDbData, clearAllData } from '@/lib/db';

export async function GET() {
    const data = getDbData();
    return NextResponse.json(data);
}

export async function DELETE() {
    clearAllData();
    return NextResponse.json({ message: 'All data deleted' });
}
