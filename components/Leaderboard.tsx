"use client";

import { useEffect, useState } from "react";

interface Score {
    id: string;
    username: string;
    score: number;
    timestamp: string;
}

export default function Leaderboard() {
    const [scores, setScores] = useState<Score[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScores = async () => {
            try {
                const res = await fetch('/api/admin'); // Reusing admin API to get all scores
                if (res.ok) {
                    const data = await res.json();
                    // Take top 3
                    setScores(data.scores.slice(0, 3));
                }
            } catch (error) {
                console.error("Failed to load leaderboard");
            } finally {
                setLoading(false);
            }
        };

        fetchScores();
    }, []);

    if (loading) return <div className="text-white text-xs animate-pulse">Loading Leaderboard...</div>;

    if (scores.length === 0) {
        return (
            <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl border-2 border-white/20 w-full max-w-[280px]">
                <h3 className="text-yellow-400 font-bold text-center mb-2 uppercase tracking-wider text-sm border-b border-white/10 pb-1">
                    🏆 Top Players
                </h3>
                <p className="text-white/60 text-xs text-center py-2">
                    No scores yet. Be the first!
                </p>
            </div>
        );
    }

    return (
        <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl border-2 border-white/20 w-full max-w-[280px]">
            <h3 className="text-yellow-400 font-bold text-center mb-2 uppercase tracking-wider text-sm border-b border-white/10 pb-1">
                🏆 Top Players
            </h3>
            <div className="flex flex-col gap-1">
                {scores.map((s, i) => (
                    <div key={s.id} className="flex justify-between items-center text-sm text-white">
                        <span className={`font-bold w-6 ${i === 0 ? 'text-yellow-300' : 'text-slate-300'}`}>
                            #{i + 1}
                        </span>
                        <span className="truncate flex-1 text-left px-2 opacity-90">{s.username}</span>
                        <span className="font-mono text-green-300 font-bold">{s.score}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
