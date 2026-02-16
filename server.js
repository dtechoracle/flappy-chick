const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(handle);
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Track players
    const players = new Map();

    io.on("connection", (socket) => {
        console.log(`Player connected: ${socket.id}`);

        // Join Game
        socket.on("join", (name) => {
            players.set(socket.id, {
                id: socket.id,
                name: name,
                x: 0,
                y: 0,
                rotation: 0,
                isDead: false
            });

            console.log(`${name} joined!`);

            // Send initial state to new player
            socket.emit("current_players", Array.from(players.values()));

            // Notify others
            socket.broadcast.emit("player_joined", players.get(socket.id));
        });

        // Update Position
        socket.on("fly", (data) => {
            if (players.has(socket.id)) {
                const player = players.get(socket.id);
                player.y = data.y;
                player.distance = data.distance; // Update distance
                player.rotation = data.rotation;
                player.isDead = data.isDead;
                player.score = data.score;
                players.set(socket.id, player);

                // Broadcast update to others (excluding sender for performance if needed, but simple for now)
                socket.broadcast.emit("player_moved", player);
            }
        });

        socket.on("disconnect", () => {
            console.log(`Player disconnected: ${socket.id}`);
            players.delete(socket.id);
            io.emit("player_left", socket.id);
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
