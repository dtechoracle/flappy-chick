"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { BoostType, BOOSTS } from "./ShopModal";
import Leaderboard from "./Leaderboard";
import { GameMode } from "@/app/page";

const GRAVITY = 0.6;
const JUMP_STRENGTH = -8;
const INITIAL_PIPE_SPEED = 3.5;
const PIPE_SPAWN_RATE = 1500; // ms
const INITIAL_BIRD_SIZE = 40;
const PIPE_WIDTH = 60;
const PIPE_GAP = 180;

interface Pipe {
    id: number;
    x: number;
    height: number;
    passed: boolean;
    gap?: number;
}

interface OtherPlayer {
    id: string;
    name: string;
    y: number;
    rotation: number;
    isDead: boolean;
    score?: number;
    distance?: number;
}

interface GameProps {
    inventory: Record<BoostType, number>;
    setInventory: React.Dispatch<React.SetStateAction<Record<BoostType, number>>>;
    onGameOver: (coins: number) => void;
    gameMode: GameMode;
}

export default function Game({ inventory, setInventory, onGameOver, gameMode }: GameProps) {
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [username, setUsername] = useState('');

    // Multiplayer State
    const [otherPlayers, setOtherPlayers] = useState<Record<string, OtherPlayer>>({});
    const [playerCount, setPlayerCount] = useState(1);
    const socketRef = useRef<Socket | null>(null);
    const distanceRef = useRef(0); // Track horizontal distance traveled for multiplayer sync

    // Boost State (for UI Rendering)
    const [activeBoosts, setActiveBoosts] = useState<{
        shield: number; // remaining time ms
        slowMo: number; // remaining time ms
        scorex2: number; // remaining time ms
        tinyBird: number; // remaining time ms
        widePipes: number; // remaining count
    }>({
        shield: 0,
        slowMo: 0,
        scorex2: 0,
        tinyBird: 0,
        widePipes: 0
    });

    // Refs for Game Loop Logic (Source of Truth)
    const activeBoostsRef = useRef<{
        shield: number;
        slowMo: number;
        scorex2: number;
        tinyBird: number;
        widePipes: number;
    }>({
        shield: 0,
        slowMo: 0,
        scorex2: 0,
        tinyBird: 0,
        widePipes: 0
    });


    const lastBoostActivation = useRef<number>(0);
    const [invincibleUntil, setInvincibleUntil] = useState(0);
    const invincibleUntilRef = useRef(0);

    // Game dimensions state
    const [gameHeight, setGameHeight] = useState(600);
    const [gameWidth, setGameWidth] = useState(450);
    const containerRef = useRef<HTMLDivElement>(null);

    // Audio Context Ref
    const audioContextRef = useRef<AudioContext | null>(null);

    // Game state refs
    const birdPosRef = useRef(gameHeight / 2);
    const birdVelRef = useRef(0);
    const pipesRef = useRef<Pipe[]>([]);
    const lastPipeTimeRef = useRef(0);
    const scoreRef = useRef(0);
    const animationFrameId = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);

    // State for rendering
    const [birdPos, setBirdPos] = useState(gameHeight / 2);
    const [birdRotation, setBirdRotation] = useState(0);
    const [pipes, setPipes] = useState<Pipe[]>([]);
    const [showTooltip, setShowTooltip] = useState(true);


    // Initialize Audio
    const initAudio = () => {
        if (!audioContextRef.current) {
            const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtor) {
                audioContextRef.current = new AudioCtor();
            }
        }
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    const playSound = (type: 'jump' | 'score' | 'die' | 'powerup' | 'shield_break') => {
        if (!audioContextRef.current) return;

        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'jump') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'score') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'die') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'powerup') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'shield_break') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    };

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setGameHeight(containerRef.current.clientHeight);
                setGameWidth(containerRef.current.clientWidth);
                if (!gameStarted && !gameOver) {
                    const center = containerRef.current.clientHeight / 2;
                    birdPosRef.current = center;
                    setBirdPos(center);
                }
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [gameStarted, gameOver]);

    // Load username from session (server-side)
    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();
                if (data.authenticated && data.username) {
                    setUsername(data.username);
                }
            } catch (error) {
                console.error('Failed to load session:', error);
            }
        };
        fetchSession();
    }, []);

    // Socket.io Multiplayer Setup
    useEffect(() => {
        if (gameMode === "multiplayer") {
            // Connect to Socket.io server
            const socket = io("http://localhost:3000", {
                transports: ["websocket", "polling"],
            });

            socketRef.current = socket;

            socket.on("connect", () => {
                console.log("Connected to multiplayer server:", socket.id);
                // Join the game with username
                const playerName = username || `Guest-${Math.floor(Math.random() * 1000)}`;
                socket.emit("join", playerName);
            });

            // Receive initial players list
            socket.on("current_players", (players: OtherPlayer[]) => {
                const playersMap: Record<string, OtherPlayer> = {};
                players.forEach(player => {
                    if (player.id !== socket.id) {
                        playersMap[player.id] = player;
                    }
                });
                setOtherPlayers(playersMap);
                setPlayerCount(players.length + 1); // +1 for self
            });

            // New player joined
            socket.on("player_joined", (player: OtherPlayer) => {
                if (player.id !== socket.id) {
                    setOtherPlayers(prev => ({
                        ...prev,
                        [player.id]: player
                    }));
                    setPlayerCount(prev => prev + 1);
                }
            });

            // Player moved
            socket.on("player_moved", (player: OtherPlayer) => {
                setOtherPlayers(prev => ({
                    ...prev,
                    [player.id]: player
                }));
            });

            // Player left
            socket.on("player_left", (playerId: string) => {
                setOtherPlayers(prev => {
                    const newPlayers = { ...prev };
                    delete newPlayers[playerId];
                    return newPlayers;
                });
                setPlayerCount(prev => Math.max(1, prev - 1));
            });

            return () => {
                socket.disconnect();
            };
        }
    }, [gameMode, username]);

    // Save Score
    const saveScore = async (finalScore: number) => {
        const nameToSave = username.trim() || `Guest-${Math.floor(Math.random() * 1000)}`;
        
        try {
            await fetch('/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: nameToSave, score: finalScore })
            });
        } catch (e) {
            console.error("Failed to save score");
        }
    };

    const handleGameOver = () => {
        if (!gameOver) {
            playSound('die');
            setGameOver(true);
            setGameStarted(false);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);

            // Emit death status in multiplayer
            if (gameMode === "multiplayer" && socketRef.current) {
                socketRef.current.emit("fly", {
                    y: birdPosRef.current,
                    distance: distanceRef.current,
                    rotation: birdRotation,
                    isDead: true,
                    score: scoreRef.current
                });
            }

            onGameOver(scoreRef.current); // Return coins
            saveScore(scoreRef.current); // Save to DB
        }
    };

    // Activate Boost
    const activateBoost = (type: BoostType, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent jump when clicking button

        const now = Date.now();
        // Prevent accidental double clicks (500ms cooldown)
        if (now - lastBoostActivation.current < 500) return;

        if ((inventory[type] || 0) > 0) {
            lastBoostActivation.current = now;
            playSound('powerup');

            // Decrement inventory safely
            setInventory(prev => {
                const currentCount = prev[type] || 0;
                if (currentCount <= 0) return prev;
                return {
                    ...prev,
                    [type]: currentCount - 1
                };
            });

            // Update Ref immediately for game loop
            const updateRef = (key: keyof typeof activeBoostsRef.current, value: number) => {
                activeBoostsRef.current = { ...activeBoostsRef.current, [key]: value };
            };

            if (type === 'shield') updateRef('shield', 10000);
            if (type === 'slowMo') updateRef('slowMo', 5000);
            if (type === 'scorex2') updateRef('scorex2', 10000);
            if (type === 'tinyBird') updateRef('tinyBird', 10000);
            if (type === 'widePipes') updateRef('widePipes', 5);

            // Sync to state to trigger UI update
            setActiveBoosts({ ...activeBoostsRef.current });
        }
    };

    const updatePhysics = useCallback((time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        // Decrease timers in Ref
        activeBoostsRef.current.shield = Math.max(0, activeBoostsRef.current.shield - deltaTime);
        activeBoostsRef.current.slowMo = Math.max(0, activeBoostsRef.current.slowMo - deltaTime);
        activeBoostsRef.current.scorex2 = Math.max(0, activeBoostsRef.current.scorex2 - deltaTime);
        activeBoostsRef.current.tinyBird = Math.max(0, activeBoostsRef.current.tinyBird - deltaTime);

        const currentPipeSpeed = activeBoostsRef.current.slowMo > 0 ? INITIAL_PIPE_SPEED * 0.5 : INITIAL_PIPE_SPEED;
        const currentBirdSize = activeBoostsRef.current.tinyBird > 0 ? 25 : INITIAL_BIRD_SIZE;
        const scoreMultiplier = activeBoostsRef.current.scorex2 > 0 ? 2 : 1;

        birdVelRef.current += GRAVITY;
        birdPosRef.current += birdVelRef.current;

        const rotation = Math.min(Math.max(birdVelRef.current * 4, -30), 45);
        setBirdRotation(rotation);

        if (birdPosRef.current >= gameHeight - currentBirdSize || birdPosRef.current <= 0) {
            handleGameOver();
            return;
        }

        // Spawn Pipe Logic
        if (time - lastPipeTimeRef.current > PIPE_SPAWN_RATE) {
            const thisGap = activeBoostsRef.current.widePipes > 0 ? 260 : PIPE_GAP;
            const minPipeHeight = 50;
            const maxPipeHeight = gameHeight - thisGap - minPipeHeight;
            const safeMax = Math.max(minPipeHeight, maxPipeHeight);
            const height = Math.floor(Math.random() * (safeMax - minPipeHeight + 1)) + minPipeHeight;

            pipesRef.current.push({
                id: time,
                x: gameWidth,
                height,
                passed: false,
                gap: thisGap
            });

            lastPipeTimeRef.current = time;

            if (activeBoostsRef.current.widePipes > 0) {
                activeBoostsRef.current.widePipes--;
            }
        }

        pipesRef.current.forEach(pipe => {
            pipe.x -= currentPipeSpeed;
        });

        if (pipesRef.current.length > 0 && pipesRef.current[0].x + PIPE_WIDTH < 0) {
            pipesRef.current.shift();
        }

        const birdLeft = 50 + 5;
        const birdRight = 50 + currentBirdSize - 5;
        const birdTop = birdPosRef.current + 5;
        const birdBottom = birdPosRef.current + currentBirdSize - 5;

        let crashed = false;

        for (const pipe of pipesRef.current) {
            const pipeLeft = pipe.x;
            const pipeRight = pipe.x + PIPE_WIDTH;
            const topPipeBottom = pipe.height;
            const pipeGap = pipe.gap || PIPE_GAP;
            const bottomPipeTop = pipe.height + pipeGap;

            if (birdRight > pipeLeft && birdLeft < pipeRight) {
                if (birdTop < topPipeBottom || birdBottom > bottomPipeTop) {
                    crashed = true;
                }
            }

            if (!pipe.passed && birdLeft > pipeRight) {
                pipe.passed = true;
                scoreRef.current += (1 * scoreMultiplier);
                setScore(scoreRef.current);
                playSound('score');
            }
        }

        if (crashed) {
            // Check if user is currently invincible from a previous shield break
            if (Date.now() < invincibleUntilRef.current) {
                // Ignore crash
            }
            // Check if shield is active (time > 0)
            else if (activeBoostsRef.current.shield > 0) {
                playSound('shield_break');
                // Deactivate shield immediately upon use
                activeBoostsRef.current.shield = 0;

                // Activate temporary invincibility (1s) to allow escape
                const now = Date.now();
                invincibleUntilRef.current = now + 1000;
                setInvincibleUntil(now + 1000);

                // Bounce mechanics
                birdVelRef.current = JUMP_STRENGTH / 2;
            } else {
                handleGameOver();
                return;
            }
        }

        // Sync state for render (Throttle this if performance issues arise, but React 18+ handles updates efficiently)
        // We only really need to sync if the display values change (like timer text descending)
        setBirdPos(birdPosRef.current);
        setPipes([...pipesRef.current]);

        // Sync boosts state for UI
        setActiveBoosts({ ...activeBoostsRef.current });

        // Emit position to server in multiplayer mode (throttled to ~every 3 frames = ~20 updates/sec)
        if (gameMode === "multiplayer" && socketRef.current && animationFrameId.current % 3 === 0) {
            distanceRef.current += currentPipeSpeed;
            socketRef.current.emit("fly", {
                y: birdPosRef.current,
                distance: distanceRef.current,
                rotation: rotation,
                isDead: false,
                score: scoreRef.current
            });
        }

        animationFrameId.current = requestAnimationFrame(updatePhysics);
    }, [gameHeight, gameWidth]); // Removed activeBoosts from dependency to avoid recreation loop issues

    const jump = useCallback(() => {
        initAudio();
        if (gameOver) return;

        if (!gameStarted) {
            // Save username to session when starting the game
            if (username.trim()) {
                fetch('/api/auth/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username.trim() })
                }).catch(err => console.error('Failed to save session:', err));
            }
            
            setGameStarted(true);
            setShowTooltip(false);
            playSound('jump');
            birdVelRef.current = JUMP_STRENGTH;
            lastPipeTimeRef.current = performance.now();
            lastTimeRef.current = performance.now();
            animationFrameId.current = requestAnimationFrame(updatePhysics);
        } else {
            playSound('jump');
            birdVelRef.current = JUMP_STRENGTH;
        }
    }, [gameStarted, gameOver, updatePhysics, username]);

    const restartGame = (e: React.MouseEvent) => {
        e.stopPropagation();
        initAudio(); // Ensure audio context is resumed
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);

        birdPosRef.current = gameHeight / 2;
        birdVelRef.current = 0;
        pipesRef.current = [];
        scoreRef.current = 0;
        distanceRef.current = 0; // Reset multiplayer distance
        lastPipeTimeRef.current = performance.now();
        lastTimeRef.current = performance.now();

        // Reset Boosts Ref and State
        activeBoostsRef.current = {
            shield: 0, slowMo: 0, scorex2: 0, tinyBird: 0, widePipes: 0
        };
        setActiveBoosts({
            shield: 0, slowMo: 0, scorex2: 0, tinyBird: 0, widePipes: 0
        });
        invincibleUntilRef.current = 0;

        setGameOver(false);
        setScore(0);
        setBirdPos(gameHeight / 2);
        setPipes([]);
        setShowTooltip(true);
        setGameStarted(false);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                e.preventDefault();
                jump();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [jump]);

    useEffect(() => {
        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, []);

    // Render Logic helpers
    const currentBirdSize = activeBoosts.tinyBird > 0 ? 25 : INITIAL_BIRD_SIZE;


    return (
        <div
            ref={containerRef}
            className={`relative w-full h-dvh md:h-[600px] md:max-w-md md:rounded-lg md:border-4 md:border-slate-800 bg-sky-300 overflow-hidden shadow-2xl cursor-pointer select-none ${activeBoosts.slowMo > 0 ? 'grayscale-50' : ''}`}
            onClick={jump}
        >
            {/* Multiplayer Player Count Indicator - Enhanced */}
            {gameMode === "multiplayer" && (
                <div className="absolute top-2 right-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 z-50 pointer-events-none border-2 border-white/40 shadow-lg backdrop-blur-sm">
                    <span className="text-lg animate-pulse">👥</span>
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs opacity-80 uppercase">Online</span>
                        <span className="text-lg font-black">{playerCount} Player{playerCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            )}

            {/* Active Boost Indicators - Enhanced */}
            <div className="absolute top-2 left-2 flex flex-col gap-2 z-50 pointer-events-none">
                {activeBoosts.shield > 0 && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-xl border-2 border-blue-300 shadow-lg backdrop-blur-sm animate-pulse">
                        <span className="text-xl">🛡️</span>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-bold uppercase opacity-90">Shield</span>
                            <span className="text-lg font-black">{Math.ceil(activeBoosts.shield / 1000)}s</span>
                        </div>
                    </div>
                )}
                {activeBoosts.slowMo > 0 && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white px-3 py-2 rounded-xl border-2 border-slate-300 shadow-lg backdrop-blur-sm">
                        <span className="text-xl">🐌</span>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-bold uppercase opacity-90">Slow Mo</span>
                            <span className="text-lg font-black">{Math.ceil(activeBoosts.slowMo / 1000)}s</span>
                        </div>
                    </div>
                )}
                {activeBoosts.scorex2 > 0 && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-2 rounded-xl border-2 border-yellow-300 shadow-lg backdrop-blur-sm">
                        <span className="text-xl">✖️2️⃣</span>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-bold uppercase opacity-90">2x Score</span>
                            <span className="text-lg font-black">{Math.ceil(activeBoosts.scorex2 / 1000)}s</span>
                        </div>
                    </div>
                )}
                {activeBoosts.tinyBird > 0 && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-xl border-2 border-purple-300 shadow-lg backdrop-blur-sm">
                        <span className="text-xl">🐥</span>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-bold uppercase opacity-90">Tiny</span>
                            <span className="text-lg font-black">{Math.ceil(activeBoosts.tinyBird / 1000)}s</span>
                        </div>
                    </div>
                )}
                {activeBoosts.widePipes > 0 && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-3 py-2 rounded-xl border-2 border-green-400 shadow-lg backdrop-blur-sm">
                        <span className="text-xl">🚪</span>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-bold uppercase opacity-90">Wide Pipes</span>
                            <span className="text-lg font-black">{activeBoosts.widePipes} left</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Animated Clouds */}
            <div className="absolute top-20 left-10 text-6xl opacity-50 animate-pulse">☁️</div>
            <div className="absolute top-40 right-20 text-6xl opacity-50 animate-pulse delay-700">☁️</div>
            <div className="absolute top-32 left-1/2 text-5xl opacity-40 animate-pulse delay-500">☁️</div>
            
            {/* Sun */}
            <div className="absolute top-5 right-5 w-16 h-16 bg-yellow-300 rounded-full shadow-[0_0_30px_rgba(250,204,21,0.6)] opacity-80" />



            {pipes.map((pipe) => {
                const pipeGap = pipe.gap || PIPE_GAP;
                return (
                    <div key={pipe.id}>
                        <div
                            className="absolute top-0 bg-green-500 border-x-4 border-b-4 border-slate-800"
                            style={{ left: pipe.x, width: PIPE_WIDTH, height: pipe.height }}
                        >
                            <div className="absolute bottom-2 left-1 right-1 h-4 bg-green-400/30 rounded-full" />
                        </div>
                        <div
                            className="absolute bottom-0 bg-green-500 border-x-4 border-t-4 border-slate-800"
                            style={{ left: pipe.x, width: PIPE_WIDTH, height: gameHeight - pipe.height - pipeGap }}
                        >
                            <div className="absolute top-2 left-1 right-1 h-4 bg-green-400/30 rounded-full" />
                        </div>
                    </div>
                );
            })}

            {/* Starting Platform */}
            {!gameStarted && !gameOver && (
                <div
                    className="absolute left-[40px] bg-green-600 border-4 border-slate-800 rounded-lg z-0"
                    style={{
                        top: birdPos + INITIAL_BIRD_SIZE,
                        width: INITIAL_BIRD_SIZE + 20,
                        height: 20,
                        transition: 'opacity 0.5s',
                    }}
                />
            )}

            {/* Other Players (Multiplayer) */}
            {gameMode === "multiplayer" && Object.values(otherPlayers).map((player) => (
                <div
                    key={player.id}
                    className="absolute flex flex-col items-center z-20 transition-all duration-100"
                    style={{
                        top: player.y,
                        left: 50,
                        width: INITIAL_BIRD_SIZE,
                        height: INITIAL_BIRD_SIZE,
                        transform: `rotate(${player.rotation}deg)`,
                        opacity: player.isDead ? 0.3 : 0.7,
                    }}
                >
                    {/* Other Player Name Tag */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap pointer-events-none">
                        {player.name}
                        {player.score !== undefined && ` (${player.score})`}
                    </div>

                    {/* Other Player Bird */}
                    <div style={{ fontSize: '2rem' }}>
                        {player.isDead ? '💀' : '🐦'}
                    </div>
                </div>
            ))}

            {/* Local Player */}
            <div
                className="absolute flex items-center justify-center z-30 transition-transform duration-100"
                style={{
                    top: birdPos,
                    left: 50,
                    width: currentBirdSize,
                    height: currentBirdSize,
                    transform: `rotate(${birdRotation}deg)`,
                }}
            >
                {/* Bird Emoji */}
                <div style={{ fontSize: activeBoosts.tinyBird > 0 ? '1.5rem' : '2.25rem' }}>
                    🐥
                </div>

                {/* Shield Bubble Overlay */}
                {activeBoosts.shield > 0 && (
                    <div className="absolute inset-[-8px] rounded-full border-2 border-blue-400 bg-blue-400/30 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)] z-40 pointer-events-none" />
                )}
                {/* Invincibility Flash */}
                {invincibleUntil > Date.now() && (
                    <div className="absolute inset-[-8px] rounded-full border-2 border-white/50 bg-white/20 animate-pulse z-40 pointer-events-none" />
                )}

                {!gameStarted && !gameOver && showTooltip && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-bold px-2 py-1 rounded shadow border-2 border-black animate-bounce whitespace-nowrap">
                        Tap to Jump
                    </div>
                )}
            </div>

            <div className="absolute bottom-0 w-full h-4 bg-emerald-600 border-t-4 border-slate-800 z-40" />

            <div className="absolute inset-0 pointer-events-none z-50">
                {/* Score Display - Enhanced */}
                <div className="absolute top-10 w-full text-center">
                    <div className="inline-block bg-black/40 backdrop-blur-sm px-6 py-2 rounded-2xl border-2 border-white/30">
                        <div className="text-5xl md:text-6xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" style={{ WebkitTextStroke: '2px black' }}>
                            {score}
                        </div>
                        <div className="text-xs text-white/80 font-bold uppercase tracking-wider">
                            Score
                        </div>
                    </div>
                </div>

                {!gameStarted && !gameOver && (
                    <div 
                        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-50 bg-slate-900"
                        onClick={(e) => {
                            // Only allow clicking on the background, not on inputs/buttons
                            if (e.target === e.currentTarget) {
                                jump();
                            }
                        }}
                    >

                        {/* Title Logo */}
                        <div className="mb-6 transform -rotate-3">
                            <h1 className="text-5xl md:text-6xl font-black text-yellow-400 drop-shadow-[0_4px_0_rgba(0,0,0,1)] stroke-black" style={{ WebkitTextStroke: '2px black' }}>
                                FLAPPY<br />CHICK
                            </h1>
                            <p className="text-center text-yellow-200 text-sm mt-2 font-bold">
                                {gameMode === "multiplayer" ? "👥 Multiplayer Mode" : "🐥 Single Player"}
                            </p>
                        </div>

                        {/* Leaderboard */}
                        <div className="mb-6">
                            <Leaderboard />
                        </div>

                        {/* Login / Start Card */}
                        <div 
                            className="bg-white p-6 rounded-2xl border-4 border-slate-800 shadow-[0_8px_0_rgba(0,0,0,0.5)] flex flex-col items-center gap-4 w-[320px] animate-in slide-in-from-bottom-10 fade-in duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {username ? (
                                // If username exists, show welcome message with option to change
                                <div className="w-full space-y-3">
                                    <div className="text-center bg-linear-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-slate-200">
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-2">Ready to Play</p>
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                            <span className="text-3xl">🐥</span>
                                            <p className="text-2xl font-black text-slate-800">
                                                {username}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUsername('');
                                        }}
                                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-bold w-full py-2 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        ✏️ Change Name
                                    </button>
                                </div>
                            ) : (
                                // If no username, show input
                                <div className="w-full space-y-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2 text-center">
                                        What's your name?
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter your name..."
                                        className="w-full px-4 py-4 rounded-xl border-3 border-slate-300 font-bold text-center text-slate-800 text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all placeholder:text-slate-400 bg-slate-50"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === 'Enter' && username.trim()) {
                                                jump();
                                            }
                                        }}
                                        maxLength={15}
                                        autoFocus
                                    />
                                    <p className="text-xs text-slate-500 text-center">
                                        Press Enter or click PLAY when ready
                                    </p>
                                </div>
                            )}

                            <button
                                className="w-full bg-green-500 hover:bg-green-400 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-xl border-b-4 border-green-700 disabled:border-slate-400 active:border-b-0 active:translate-y-1 transition-all text-xl shadow-lg flex items-center justify-center gap-3"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (username.trim() || username) {
                                        jump();
                                    }
                                }}
                                disabled={!username && !username.trim()}
                            >
                                <span>START GAME</span>
                                <span className="text-2xl">▶️</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* BOOST CONTROLS - Enhanced UI */}
                {gameStarted && !gameOver && (
                    <div className="absolute bottom-6 w-full flex justify-center gap-2 md:gap-3 pointer-events-auto px-2">
                        {BOOSTS.map(boost => {
                            const count = inventory[boost.id] || 0;
                            const isAvailable = count > 0;
                            
                            return (
                                <button
                                    key={boost.id}
                                    onClick={(e) => activateBoost(boost.id, e)}
                                    disabled={!isAvailable}
                                    title={boost.name}
                                    className={`
                                        relative w-14 h-14 md:w-16 md:h-16 rounded-xl border-3 font-bold text-2xl flex items-center justify-center shadow-2xl transition-all duration-200
                                        ${isAvailable
                                            ? 'bg-white border-white/80 opacity-100 ring-2 ring-black/30 hover:scale-110 active:scale-95 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)]'
                                            : 'bg-black/40 border-white/10 opacity-30 grayscale cursor-not-allowed'}
                                    `}
                                >
                                    <span className={isAvailable ? 'animate-pulse' : ''}>{boost.emoji}</span>
                                    
                                    {/* Count Badge - Enhanced */}
                                    <div className={`absolute -top-2 -right-2 ${count > 0 ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-slate-500'} text-white text-xs font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-lg ${count > 0 ? 'animate-bounce' : ''}`}>
                                        {count}
                                    </div>
                                    
                                    {/* Glow effect when available */}
                                    {isAvailable && (
                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}


                {gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white backdrop-blur-md animate-in fade-in zoom-in duration-300 pointer-events-auto">
                        <div className="text-8xl mb-4 animate-bounce">💀</div>
                        <h2 className="text-6xl md:text-7xl font-black text-red-500 mb-8 drop-shadow-[0_6px_0_rgba(0,0,0,1)] stroke-black animate-in slide-in-from-top" style={{ WebkitTextStroke: '2px black' }}>
                            GAME OVER
                        </h2>
                        
                        <div className="bg-gradient-to-br from-yellow-100 to-orange-100 p-8 rounded-3xl border-4 border-black text-center shadow-[0_12px_0_rgba(0,0,0,1)] max-w-md w-full mx-4 animate-in slide-in-from-bottom">
                            <div className="flex items-center justify-center gap-3 mb-4">
                                <span className="text-4xl">💰</span>
                                <p className="text-2xl text-orange-800 font-bold uppercase tracking-wide">Coins Earned</p>
                            </div>
                            <p className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 mb-2">
                                +{score}
                            </p>
                            <p className="text-sm text-slate-600 mb-6">
                                {score > 10 ? "Great job! 🎉" : score > 5 ? "Nice try! 💪" : "Keep practicing! 🐥"}
                            </p>

                            <div className="space-y-3">
                                <button
                                    className="pointer-events-auto px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-black text-xl rounded-xl border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all w-full flex items-center justify-center gap-2 shadow-lg"
                                    onClick={restartGame}
                                >
                                    <span>🔄</span>
                                    <span>PLAY AGAIN</span>
                                </button>
                                <button
                                    className="pointer-events-auto px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-black text-xl rounded-xl border-b-4 border-slate-900 active:border-b-0 active:translate-y-1 transition-all w-full flex items-center justify-center gap-2 shadow-lg"
                                    onClick={() => {
                                        onGameOver(score);
                                    }}
                                >
                                    <span>🏠</span>
                                    <span>HOME & SHOP</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
