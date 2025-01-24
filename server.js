const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for Render deployment
    methods: ["GET", "POST"]
  }
});

// Use environment variable for port (Render requirement)
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Room Creation
  socket.on('createRoom', () => {
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    const room = {
      id: roomId,
      host: socket.id,
      players: new Set(),
      gameState: {
        started: false,
        ropePosition: 50,
        teams: {
          red: new Set(),
          blue: new Set()
        }
      }
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  // Room Joining
  socket.on('joinRoom', (roomId) => {
    const formattedId = roomId.toUpperCase().trim();
    const room = rooms.get(formattedId);
    
    if (!room) return socket.emit('invalidRoom');
    if (room.players.size >= 4) return socket.emit('roomFull');

    socket.join(formattedId);
    room.players.add(socket.id);
    
    socket.emit('roomJoined', {
      id: formattedId,
      isHost: socket.id === room.host,
      players: Array.from(room.players)
    });
    
    socket.to(formattedId).emit('playerJoined', room.players.size);
  });

  // Team Management
  socket.on('joinTeam', ({ roomId, team }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState.started) return;

    room.gameState.teams.red.delete(socket.id);
    room.gameState.teams.blue.delete(socket.id);
    
    room.gameState.teams[team].add(socket.id);
    socket.team = team;
    
    socket.emit('teamJoined', team);
    io.to(roomId).emit('teamUpdate', {
      red: room.gameState.teams.red.size,
      blue: room.gameState.teams.blue.size
    });
  });

  // Game Control
  socket.on('startGame', (roomId) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.host) return;

    if (room.gameState.teams.red.size > 0 && room.gameState.teams.blue.size > 0) {
      room.gameState.started = true;
      io.to(roomId).emit('gameStarted', room.gameState);
    }
  });

  // Gameplay
  socket.on('tug', (roomId) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameState.started || !socket.team) return;

    const strength = 1 + (room.gameState.teams[socket.team].size * 0.2);
    room.gameState.ropePosition += socket.team === 'red' ? -strength : strength;
    room.gameState.ropePosition = Math.max(0, Math.min(100, room.gameState.ropePosition));

    if (room.gameState.ropePosition <= 0 || room.gameState.ropePosition >= 100) {
      const winner = room.gameState.ropePosition <= 0 ? 'red' : 'blue';
      io.to(roomId).emit('gameOver', winner);
      resetGame(room);
    } else {
      io.to(roomId).emit('update', room.gameState);
    }
  });

  // Disconnect Handling
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        room.gameState.teams.red.delete(socket.id);
        room.gameState.teams.blue.delete(socket.id);
        
        if (room.players.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('teamUpdate', {
            red: room.gameState.teams.red.size,
            blue: room.gameState.teams.blue.size
          });
        }
      }
    });
  });
});

function resetGame(room) {
  room.gameState.started = false;
  room.gameState.ropePosition = 50;
  setTimeout(() => io.to(room.id).emit('update', room.gameState), 3000);
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
