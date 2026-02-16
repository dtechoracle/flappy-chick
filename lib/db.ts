import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db.json');

export interface Score {
    id: string;
    username: string;
    score: number;
    timestamp: string;
}

export interface Database {
    scores: Score[];
    users: any[];
}

// Ensure DB exists
const ensureDb = () => {
    if (!fs.existsSync(dbPath)) {
        const initialData: Database = { scores: [], users: [] };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    }
};

export const getDbData = (): Database => {
    ensureDb();
    const data = fs.readFileSync(dbPath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (error) {
        return { scores: [], users: [] };
    }
};

export const saveScore = (username: string, score: number) => {
    const data = getDbData();
    const newScore: Score = {
        id: Date.now().toString(),
        username,
        score,
        timestamp: new Date().toISOString()
    };
    data.scores.push(newScore);
    // Sort by score desc, keep top 100
    data.scores.sort((a, b) => b.score - a.score);
    if (data.scores.length > 100) {
        data.scores = data.scores.slice(0, 100);
    }

    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return newScore;
};

export const clearAllData = () => {
    const emptyData: Database = { scores: [], users: [] };
    fs.writeFileSync(dbPath, JSON.stringify(emptyData, null, 2));
};
