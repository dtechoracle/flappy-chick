"use client";

import { useState, useEffect } from 'react';

interface Score {
    id: string;
    username: string;
    score: number;
    timestamp: string;
}

export default function AdminPage() {
    const [data, setData] = useState<{ scores: Score[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin');
            if (!res.ok) throw new Error('Failed to fetch data');
            const jsonData = await res.json();
            setData(jsonData);
        } catch (err) {
            setError('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoggedIn) {
            fetchData();
        }
    }, [isLoggedIn]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'admin123') {
            setIsLoggedIn(true);
        } else {
            alert('Incorrect password');
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm('ARE YOU SURE? This will delete ALL scores and data permanently.')) return;

        try {
            const res = await fetch('/api/admin', { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            alert('All data deleted.');
            fetchData(); // Reload
        } catch (err) {
            alert('Error deleting data');
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-xl shadow-xl border border-slate-700 w-full max-w-sm">
                    <h1 className="text-2xl font-bold text-blue-400 mb-6 text-center">Admin Login</h1>
                    <input
                        type="password"
                        placeholder="Enter Password"
                        className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4 focus:outline-none focus:border-blue-500"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                        Login
                    </button>
                    <p className="text-slate-500 text-xs text-center mt-4">(Hint: admin123)</p>
                </form>
            </div>
        );
    }

    if (loading) return <div className="p-10 text-white">Loading...</div>;
    if (error) return <div className="p-10 text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-blue-400">Admin Dashboard</h1>
                    <button
                        onClick={handleDeleteAll}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded shadow-lg transition-colors"
                    >
                        DELETE ALL DATA
                    </button>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
                    <h2 className="text-2xl font-bold mb-4 border-b border-slate-600 pb-2">Recent Scores</h2>

                    {!data?.scores.length ? (
                        <p className="text-slate-400 italic">No scores recorded yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="p-3">Rank</th>
                                        <th className="p-3">Username</th>
                                        <th className="p-3">Score</th>
                                        <th className="p-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.scores.map((score, index) => (
                                        <tr key={score.id} className="border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors">
                                            <td className="p-3 text-slate-300">#{index + 1}</td>
                                            <td className="p-3 font-bold text-blue-300">{score.username}</td>
                                            <td className="p-3 font-mono text-yellow-400 text-lg">{score.score}</td>
                                            <td className="p-3 text-sm text-slate-500">{new Date(score.timestamp).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center text-slate-500 text-sm">
                    <p>Database Path: /db.json</p>
                </div>
            </div>
        </div>
    );
}
