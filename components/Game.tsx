"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const GRAVITY = 0.6;
const JUMP_STRENGTH = -8;
const PIPE_SPEED = 3.5;
const PIPE_SPAWN_RATE = 1500; // ms
const BIRD_SIZE = 40;
const PIPE_WIDTH = 60;
const PIPE_GAP = 180;

interface Pipe {
    id: number;
    x: number;
    height: number;
    passed: boolean;
}

interface Player {
    id: string;
    name: string;
    x: number; // Not strictly needed if fixed x for self, but useful for others if we vary
    y: number;
    rotation: number;
    isDead: boolean;
    score?: number;
}

export default function Game() {
    const [playerName, setPlayerName] = useState("");
    const [hasJoined, setHasJoined] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [otherPlayers, setOtherPlayers] = useState<Map<string, Player>>(new Map());

    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);

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

    // State for rendering
    const [birdPos, setBirdPos] = useState(gameHeight / 2);
    const [birdRotation, setBirdRotation] = useState(0);
    const [pipes, setPipes] = useState<Pipe[]>([]);
    const [showTooltip, setShowTooltip] = useState(true);

    // Initialize Socket
    useEffect(() => {
        // Connect to same host
        const newSocket = io();
        setSocket(newSocket);

        newSocket.on("current_players", (players: Player[]) => {
            const map = new Map<string, Player>();
            players.forEach(p => {
                if (p.id !== newSocket.id) {
                    map.set(p.id, p);
                }
            });
            setOtherPlayers(map);
        });

        newSocket.on("player_joined", (player: Player) => {
            setOtherPlayers(prev => {
                const newMap = new Map(prev);
                newMap.set(player.id, player);
                return newMap;
            });
        });

        newSocket.on("player_moved", (player: Player) => {
            setOtherPlayers(prev => {
                const newMap = new Map(prev);
                newMap.set(player.id, player);
                return newMap;
            });
        });

        newSocket.on("player_left", (id: string) => {
            setOtherPlayers(prev => {
                const newMap = new Map(prev);
                newMap.delete(id);
                return newMap;
            });
        });

        return () => {
            newSocket.disconnect();
        }
    }, []);

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

    const playSound = (type: 'jump' | 'score' | 'die') => {
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

    // Sync Logic
    const emitUpdate = () => {
        if (socket && hasJoined) {
            const rotation = Math.min(Math.max(birdVelRef.current * 4, -30), 45);
            socket.emit("fly", {
                y: birdPosRef.current,
                rotation: rotation,
                isDead: gameOver,
                score: scoreRef.current
            });
        }
    };

    const spawnPipe = (time: number) => {
        if (time - lastPipeTimeRef.current > PIPE_SPAWN_RATE) {
            const minPipeHeight = 50;
            const maxPipeHeight = gameHeight - PIPE_GAP - minPipeHeight;
            const height = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
            pipesRef.current.push({
                id: time,
                x: gameWidth,
                height,
                passed: false,
            });
            lastPipeTimeRef.current = time;
        }
    };

    const updatePhysics = useCallback((time: number) => {
        birdVelRef.current += GRAVITY;
        birdPosRef.current += birdVelRef.current;

        const rotation = Math.min(Math.max(birdVelRef.current * 4, -30), 45);
        setBirdRotation(rotation);

        if (birdPosRef.current >= gameHeight - BIRD_SIZE || birdPosRef.current <= 0) {
            handleGameOver();
            return;
        }

        spawnPipe(time);

        pipesRef.current.forEach(pipe => {
            pipe.x -= PIPE_SPEED;
        });

        if (pipesRef.current.length > 0 && pipesRef.current[0].x + PIPE_WIDTH < 0) {
            pipesRef.current.shift();
        }

        const birdLeft = 50 + 5;
        const birdRight = 50 + BIRD_SIZE - 5;
        const birdTop = birdPosRef.current + 5;
        const birdBottom = birdPosRef.current + BIRD_SIZE - 5;

        let crashed = false;
        pipesRef.current.forEach(pipe => {
            const pipeLeft = pipe.x;
            const pipeRight = pipe.x + PIPE_WIDTH;
            const topPipeBottom = pipe.height;
            const bottomPipeTop = pipe.height + PIPE_GAP;

            if (birdRight > pipeLeft && birdLeft < pipeRight) {
                if (birdTop < topPipeBottom || birdBottom > bottomPipeTop) {
                    crashed = true;
                }
            }

            if (!pipe.passed && birdLeft > pipeRight) {
                pipe.passed = true;
                scoreRef.current += 1;
                setScore(scoreRef.current);
                playSound('score');
            }
        });

        if (crashed) {
            handleGameOver();
            return;
        }

        // Sync state for render
        setBirdPos(birdPosRef.current);
        setPipes([...pipesRef.current]);

        // Emit socket update
        emitUpdate();

        animationFrameId.current = requestAnimationFrame(updatePhysics);
    }, [gameHeight, gameWidth, socket, hasJoined]);

    const handleGameOver = () => {
        if (!gameOver) {
            playSound('die');
            setGameOver(true);
            setGameStarted(false);
            if (socket && hasJoined) socket.emit("fly", { y: birdPosRef.current, rotation: 90, isDead: true, score: scoreRef.current });
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        }
    };

    const jump = useCallback(() => {
        initAudio();
        if (gameOver || !hasJoined) return;

        if (!gameStarted) {
            setGameStarted(true);
            setShowTooltip(false);
            playSound('jump');
            birdVelRef.current = JUMP_STRENGTH;
            lastPipeTimeRef.current = performance.now();
            animationFrameId.current = requestAnimationFrame(updatePhysics);
        } else {
            playSound('jump');
            birdVelRef.current = JUMP_STRENGTH;
        }
    }, [gameStarted, gameOver, updatePhysics, hasJoined]);

    const restartGame = (e: React.MouseEvent) => {
        e.stopPropagation();
        initAudio();
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);

        birdPosRef.current = gameHeight / 2;
        birdVelRef.current = 0;
        pipesRef.current = [];
        scoreRef.current = 0;
        lastPipeTimeRef.current = performance.now();

        setGameOver(false);
        setScore(0);
        setBirdPos(gameHeight / 2);
        setPipes([]);
        setShowTooltip(true);
        setGameStarted(false);

        // Reset rotation for others
        if (socket && hasJoined) socket.emit("fly", { y: gameHeight / 2, rotation: 0, isDead: false, score: 0 });
    };

    const joinGame = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim() && socket) {
            socket.emit("join", playerName);
            setHasJoined(true);
        }
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

    if (!hasJoined) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-sky-300 p-4">
                <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border-4 border-slate-800 text-center">
                    <h1 className="text-4xl font-black mb-6 text-yellow-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)] stroke-black" style={{ WebkitTextStroke: '1.5px black' }}>FLAPPY CHICK</h1>
                    <form onSubmit={joinGame} className="flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Enter your name"
                            className="p-4 rounded-xl border-2 border-slate-300 text-xl font-bold focus:outline-none focus:border-green-500"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            maxLength={12}
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="p-4 bg-green-500 hover:bg-green-400 text-white font-black text-xl rounded-xl border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all"
                            disabled={!playerName.trim()}
                        >
                            JOIN GAME
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-dvh md:h-[600px] md:max-w-md md:rounded-lg md:border-4 md:border-slate-800 bg-sky-300 overflow-hidden shadow-2xl cursor-pointer select-none"
            onClick={jump}
        >
            <div className="absolute top-20 left-10 text-6xl opacity-50 animate-pulse">☁️</div>
            <div className="absolute top-40 right-20 text-6xl opacity-50 animate-pulse delay-700">☁️</div>

            {pipes.map((pipe) => (
                <div key={pipe.id}>
                    <div
                        className="absolute top-0 bg-green-500 border-x-4 border-b-4 border-slate-800"
                        style={{ left: pipe.x, width: PIPE_WIDTH, height: pipe.height }}
                    >
                        <div className="absolute bottom-2 left-1 right-1 h-4 bg-green-400/30 rounded-full" />
                    </div>
                    <div
                        className="absolute bottom-0 bg-green-500 border-x-4 border-t-4 border-slate-800"
                        style={{ left: pipe.x, width: PIPE_WIDTH, height: gameHeight - pipe.height - PIPE_GAP }}
                    >
                        <div className="absolute top-2 left-1 right-1 h-4 bg-green-400/30 rounded-full" />
                    </div>
                </div>
            ))}

            {!gameStarted && !gameOver && (
                <div
                    className="absolute left-[40px] bg-green-600 border-4 border-slate-800 rounded-lg"
                    style={{
                        top: birdPos + BIRD_SIZE,
                        width: BIRD_SIZE + 20,
                        height: 20,
                        transition: 'opacity 0.5s',
                    }}
                />
            )}

            {/* Render Other Players (Ghost Birds) */}
            {Array.from(otherPlayers.values()).map(player => (
                <div
                    key={player.id}
                    className="absolute text-4xl flex items-center justify-center opacity-40 grayscale"
                    style={{
                        top: player.y,
                        left: 50, // All birds aligned horizontally for now unless we sync X properly
                        width: BIRD_SIZE,
                        height: BIRD_SIZE,
                        transform: `rotate(${player.rotation}deg)`,
                        transition: 'top 0.1s linear, transform 0.1s linear',
                        zIndex: 5
                    }}
                >
                    🐥
                    <div className="absolute -top-6 text-xs font-bold bg-black/50 text-white px-2 py-1 rounded whitespace-nowrap">
                        {player.name}
                    </div>
                </div>
            ))}

            {/* Local Player */}
            <div
                className="absolute text-4xl flex items-center justify-center z-10"
                style={{
                    top: birdPos,
                    left: 50,
                    width: BIRD_SIZE,
                    height: BIRD_SIZE,
                    transform: `rotate(${birdRotation}deg)`,
                    transition: 'transform 0.1s ease-out'
                }}
            >
                🐥
                {!gameStarted && !gameOver && showTooltip && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-xs font-bold px-2 py-1 rounded shadow border-2 border-black animate-bounce whitespace-nowrap">
                        You
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r-2 border-b-2 border-black rotate-45 transform"></div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-0 w-full h-4 bg-emerald-600 border-t-4 border-slate-800 z-20" />

            <div className="absolute inset-0 pointer-events-none z-30">
                <div className="absolute top-10 w-full text-center text-6xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] stroke-black" style={{ WebkitTextStroke: '2px black' }}>
                    {score}
                </div>

                <div className="absolute top-4 right-4 text-white font-bold bg-black/40 px-3 py-1 rounded-full">
                    Players Online: {otherPlayers.size + 1}
                </div>

                {!gameStarted && !gameOver && (
                    <div className="absolute inset-x-0 bottom-20 flex flex-col items-center justify-center text-center">
                        <div className="animate-pulse bg-black/40 text-white px-6 py-3 rounded-full font-bold border-2 border-white/20 backdrop-blur-sm">
                            Tap to Flap
                        </div>
                    </div>
                )}

                {gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-sm animate-in fade-in zoom-in duration-300">
                        <h2 className="text-6xl font-black text-red-500 mb-6 drop-shadow-[0_4px_0_rgba(0,0,0,1)] stroke-black" style={{ WebkitTextStroke: '2px black' }}>GAME OVER</h2>
                        <div className="bg-yellow-100 p-8 rounded-2xl border-4 border-black text-center shadow-[0_8px_0_rgba(0,0,0,1)]">
                            <p className="text-xl text-yellow-800 font-bold mb-2 uppercase tracking-wide">Score</p>
                            <p className="text-7xl font-black text-black mb-6">{score}</p>
                            <button
                                className="pointer-events-auto px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-black text-xl rounded-xl border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all"
                                onClick={restartGame}
                            >
                                PLAY AGAIN
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
