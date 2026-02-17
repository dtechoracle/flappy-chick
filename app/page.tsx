"use client";

import { useState, useEffect } from "react";
import Game from "@/components/Game";
import ShopModal, { BoostType, BoostItem } from "@/components/ShopModal";

export type GameMode = "single" | "multiplayer";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("single");

  // Currency & Inventory State
  // Initialize with some coins so they can try the shop immediately
  const [coins, setCoins] = useState(1000);
  const [inventory, setInventory] = useState<Record<BoostType, number>>({
    shield: 0,
    slowMo: 0,
    scorex2: 0,
    tinyBird: 0,
    widePipes: 0
  });

  // Load from local storage on mount
  useEffect(() => {
    const savedCoins = localStorage.getItem('flappy_coins_v3');
    if (savedCoins) setCoins(parseInt(savedCoins));

    const savedInv = localStorage.getItem('flappy_inventory_v3');
    if (savedInv) setInventory(JSON.parse(savedInv));
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('flappy_coins_v3', coins.toString());
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('flappy_inventory_v3', JSON.stringify(inventory));
  }, [inventory]);

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
      <div className="absolute inset-0 z-0 bg-linear-to-b from-sky-300 to-sky-100"></div>
      <div className="absolute bottom-0 w-full h-1/3 bg-[#F4D03F] border-t-8 border-[#D4AC0D]"></div> {/* Sand */}

      {/* Ocean */}
      <div className="absolute bottom-1/3 w-full h-24 bg-blue-500 opacity-80 animate-pulse"></div>
      <div className="absolute bottom-[35%] w-full h-20 bg-blue-400 opacity-60 animate-pulse delay-75"></div>

      {/* Sun */}
      <div className="absolute top-10 right-10 w-24 h-24 bg-yellow-400 rounded-full shadow-[0_0_40px_rgba(255,200,0,0.8)] animate-pulse"></div>

      {/* Palm Trees (Simple CSS Art/Emoji for now) */}
      <div className="absolute bottom-[30%] left-10 text-9xl transform -scale-x-100 z-10">🌴</div>
      <div className="absolute bottom-[28%] right-5 text-9xl z-10">🌴</div>

      <div className="z-20 flex flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center animate-bounce">
          <h1 className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.4)] stroke-black"
            style={{ WebkitTextStroke: '3px black' }}>
            FLAPPY <br /> CHICK
          </h1>
        </div>

        <div className="flex flex-col gap-4 w-64">
          <button
            onClick={() => {
              setGameMode("single");
              setIsPlaying(true);
            }}
            className="bg-green-500 hover:bg-green-400 text-white text-2xl font-black py-4 px-8 rounded-2xl border-b-8 border-green-700 active:border-b-0 active:translate-y-2 transition-all shadow-xl flex items-center justify-center gap-2"
          >
            <span>🐥</span> SINGLE PLAYER
          </button>

          <button
            onClick={() => {
              setGameMode("multiplayer");
              setIsPlaying(true);
            }}
            className="bg-blue-500 hover:bg-blue-400 text-white text-2xl font-black py-4 px-8 rounded-2xl border-b-8 border-blue-700 active:border-b-0 active:translate-y-2 transition-all shadow-xl flex items-center justify-center gap-2"
          >
            <span>👥</span> MULTIPLAYER
          </button>

          <button
            onClick={() => setShowShop(true)}
            className="bg-orange-400 hover:bg-orange-300 text-white text-2xl font-black py-4 px-8 rounded-2xl border-b-8 border-orange-600 active:border-b-0 active:translate-y-2 transition-all shadow-xl flex items-center justify-center gap-2"
          >
            <span>🛒</span> SHOP
          </button>
        </div>

        <div className="bg-black/20 backdrop-blur-md px-6 py-2 rounded-full text-white font-bold border-2 border-white/30">
          Your Coins: 💰 {coins}
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
