"use client";

import { useEffect, useState } from "react";

export type BoostType = 'shield' | 'slowMo' | 'scorex2' | 'tinyBird' | 'widePipes';

export interface BoostItem {
    id: BoostType;
    name: string;
    emoji: string;
    cost: number;
    description: string;
}

export const BOOSTS: BoostItem[] = [
    { id: 'shield', name: 'Shield', emoji: '🛡️', cost: 50, description: 'Survive one hit' },
    { id: 'slowMo', name: 'Slow Motion', emoji: '🐌', cost: 30, description: 'Slower speed for 5s' },
    { id: 'scorex2', name: '2x Score', emoji: '✖️2️⃣', cost: 40, description: 'Double points for 10s' },
    { id: 'tinyBird', name: 'Tiny Bird', emoji: '🐥', cost: 40, description: 'Half size for 10s' },
    { id: 'widePipes', name: 'Wide Pipes', emoji: '🚪', cost: 60, description: 'Wider gap for next 5 pipes' },
];

interface ShopModalProps {
    coins: number;
    inventory: Record<BoostType, number>;
    onClose: () => void;
    onBuy: (item: BoostItem) => void;
}

export default function ShopModal({ coins, inventory, onClose, onBuy }: ShopModalProps) {
    return (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border-4 border-yellow-500">
                {/* Header */}
                <div className="bg-yellow-400 p-4 flex justify-between items-center border-b-4 border-yellow-500">
                    <h2 className="text-3xl font-black text-white stroke-black drop-shadow-md" style={{ WebkitTextStroke: '1.5px black' }}>
                        SHOP
                    </h2>
                    <div className="bg-white px-3 py-1 rounded-full font-bold border-2 border-yellow-600 flex items-center gap-2">
                        <span>💰</span>
                        <span>{coins}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-red-500 text-white w-8 h-8 rounded-full font-bold border-b-4 border-red-700 active:border-b-0 active:translate-y-1 hover:bg-red-400 transition-all"
                    >
                        X
                    </button>
                </div>

                {/* Items Grid */}
                <div className="p-4 grid gap-3 max-h-[60vh] overflow-y-auto">
                    {BOOSTS.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-slate-100 rounded-xl border-2 border-slate-200 hover:border-blue-400 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="text-4xl bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                                    {item.emoji}
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{item.name}</div>
                                    <div className="text-xs text-slate-500 font-medium">{item.description}</div>
                                    <div className="text-xs font-bold text-blue-600 mt-1">
                                        Owned: {inventory[item.id] || 0}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => onBuy(item)}
                                disabled={coins < item.cost}
                                className={`
                                    px-4 py-2 rounded-xl font-black text-sm border-b-4 transition-all
                                    ${coins >= item.cost
                                        ? 'bg-green-500 text-white border-green-700 hover:bg-green-400 active:border-b-0 active:translate-y-1'
                                        : 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed'}
                                `}
                            >
                                <div className="flex flex-col items-center">
                                    <span>BUY</span>
                                    <span className="text-xs font-normal opacity-90">{item.cost} 💰</span>
                                </div>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
