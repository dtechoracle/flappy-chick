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
      methods: ["GET", "POST"],
    },
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
        y: 300,
        rotation: 0,
        isDead: false,
        score: 0,
      });

      console.log(`${name} joined! Total players: ${players.size}`);

      // Send current players to the new player (excluding self)
      const otherPlayers = Array.from(players.values()).filter(
        (p) => p.id !== socket.id
      );
      socket.emit("current_players", otherPlayers);

      // Notify ALL other players about the new player
      socket.broadcast.emit("player_joined", players.get(socket.id));
    });

    // Update Position
    socket.on("fly", (data) => {
      if (players.has(socket.id)) {
        const player = players.get(socket.id);
        player.y = data.y;
        player.rotation = data.rotation;
        player.isDead = data.isDead || false;
        player.score = data.score || 0;
        players.set(socket.id, player);

        // Broadcast update to ALL other players
        socket.broadcast.emit("player_moved", player);
      }
    });

    socket.on("disconnect", () => {
      console.log(
        `Player disconnected: ${socket.id}. Remaining: ${players.size - 1}`
      );
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
