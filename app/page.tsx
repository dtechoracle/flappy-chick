"use client";

import { useState, useEffect } from "react";
import Game from "@/components/Game";
import ShopModal, { BoostType, BoostItem } from "@/components/ShopModal";

export type GameMode = "single" | "multiplayer";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("single");
  const [loading, setLoading] = useState(true);

  // Currency & Inventory State
  const [coins, setCoins] = useState(0);
  const [inventory, setInventory] = useState<Record<BoostType, number>>({
    shield: 0,
    slowMo: 0,
    scorex2: 0,
    tinyBird: 0,
    widePipes: 0
  });

  // Load from database on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const res = await fetch('/api/user');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setCoins(data.data.coins);
            setInventory(data.data.inventory);
          }
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, []);

  // Save to database when coins or inventory change
  useEffect(() => {
    if (!loading) {
      const saveUserData = async () => {
        try {
          await fetch('/api/user', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coins, inventory })
          });
        } catch (error) {
          console.error('Failed to save user data:', error);
        }
      };
      saveUserData();
    }
  }, [coins, inventory, loading]);

  const handleBuy = (item: BoostItem) => {
    if (coins >= item.cost) {
      setCoins(prev => prev - item.cost);
      setInventory(prev => ({
        ...prev,
        [item.id]: (prev[item.id] || 0) + 1
      }));
    }
  };

  const handleGameOverReturn = (sessionCoins: number) => {
    setCoins(prev => prev + sessionCoins);
    setIsPlaying(false);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-sky-300">
        <div className="text-white text-2xl font-bold animate-pulse">
          Loading... 🐥
        </div>
      </main>
    );
  }

  if (isPlaying) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-sky-300 overflow-hidden">
        <Game
          inventory={inventory}
          setInventory={setInventory}
          onGameOver={(earnedCoins) => handleGameOverReturn(earnedCoins)}
          gameMode={gameMode}
        />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Beach Background */}
      <div className="absolute inset-0 z-0 bg-linear-to-b from-sky-400 via-sky-300 to-sky-200"></div>
      <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-[#F4D03F] to-[#F7DC6F] border-t-8 border-[#D4AC0D]"></div>

      {/* Ocean Waves */}
      <div className="absolute bottom-1/3 w-full h-24 bg-blue-500 opacity-80 animate-pulse"></div>
      <div className="absolute bottom-[35%] w-full h-20 bg-blue-400 opacity-60 animate-pulse delay-75"></div>

      {/* Sun */}
      <div className="absolute top-10 right-10 w-28 h-28 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full shadow-[0_0_60px_rgba(255,200,0,0.8)] animate-pulse"></div>

      {/* Floating Islands/Clouds */}
      <div className="absolute top-1/4 left-5 text-8xl opacity-30 animate-bounce">☁️</div>
      <div className="absolute top-1/3 right-10 text-7xl opacity-25 animate-bounce delay-300">☁️</div>

      {/* Palm Trees */}
      <div className="absolute bottom-[30%] left-10 text-9xl transform -scale-x-100 z-10 drop-shadow-lg">🌴</div>
      <div className="absolute bottom-[28%] right-5 text-9xl z-10 drop-shadow-lg">🌴</div>

      <div className="z-20 flex flex-col items-center gap-8 px-4">
        {/* Title with better animation */}
        <div className="text-center">
          <div className="mb-4 animate-bounce">
            <div className="text-8xl mb-2">🐥</div>
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.5)] stroke-black mb-2 transform hover:scale-105 transition-transform"
            style={{ WebkitTextStroke: '3px black' }}>
            FLAPPY <br /> CHICK
          </h1>
          <p className="text-yellow-300 font-bold text-lg drop-shadow-md">
            Fly, Compete & Conquer! 🏆
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          <button
            onClick={() => {
              setGameMode("single");
              setIsPlaying(true);
            }}
            className="group relative bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white text-2xl font-black py-5 px-8 rounded-2xl border-b-8 border-green-800 active:border-b-0 active:translate-y-2 transition-all shadow-2xl flex items-center justify-between overflow-hidden"
          >
            <span className="flex items-center gap-3">
              <span className="text-3xl group-hover:scale-110 transition-transform">🐥</span>
              <span>SINGLE PLAYER</span>
            </span>
            <span className="text-green-200 text-sm font-bold">SOLO</span>
          </button>

          <button
            onClick={() => {
              setGameMode("multiplayer");
              setIsPlaying(true);
            }}
            className="group relative bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-2xl font-black py-5 px-8 rounded-2xl border-b-8 border-blue-800 active:border-b-0 active:translate-y-2 transition-all shadow-2xl flex items-center justify-between overflow-hidden"
          >
            <span className="flex items-center gap-3">
              <span className="text-3xl group-hover:scale-110 transition-transform">👥</span>
              <span>MULTIPLAYER</span>
            </span>
            <span className="text-blue-200 text-sm font-bold animate-pulse">LIVE</span>
          </button>

          <button
            onClick={() => setShowShop(true)}
            className="group relative bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-300 hover:to-orange-400 text-white text-2xl font-black py-5 px-8 rounded-2xl border-b-8 border-orange-700 active:border-b-0 active:translate-y-2 transition-all shadow-2xl flex items-center justify-between overflow-hidden"
          >
            <span className="flex items-center gap-3">
              <span className="text-3xl group-hover:scale-110 transition-transform">🛒</span>
              <span>SHOP</span>
            </span>
            <span className="text-orange-200 text-sm font-bold">BUY ITEMS</span>
          </button>
        </div>

        {/* Coins Display - Enhanced */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-8 py-4 rounded-2xl text-black font-black border-4 border-yellow-600 shadow-xl flex items-center gap-3 transform hover:scale-105 transition-transform">
          <span className="text-3xl">💰</span>
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">Your Balance</p>
            <p className="text-3xl">{coins.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {showShop && (
        <ShopModal
          coins={coins}
          inventory={inventory}
          onClose={() => setShowShop(false)}
          onBuy={handleBuy}
        />
      )}
    </main>
  );
}
