const socket = io();
let currentRoom = null;
let isHost = false;
let currentTeam = null;

// UI Elements
const lobbySection = document.getElementById('lobby');
const roomInterface = document.getElementById('roomInterface');
const gameContainer = document.getElementById('gameContainer');
const startBtn = document.getElementById('startBtn');
const tugButton = document.getElementById('tugButton');
const redBtn = document.getElementById('redBtn');
const blueBtn = document.getElementById('blueBtn');

// Room Management
function createRoom() {
  socket.emit('createRoom');
  lobbySection.style.display = 'none';
}

function joinRoom() {
  const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
  if (!roomCode) return alert('Please enter a room code!');
  socket.emit('joinRoom', roomCode);
}

// Team Management
function joinTeam(team) {
  if (!currentRoom) return;
  socket.emit('joinTeam', { roomId: currentRoom, team });
}

// Game Control
function startGame() {
  if (!currentRoom || !isHost) return;
  socket.emit('startGame', currentRoom);
}

function tug() {
  if (!currentRoom || !currentTeam) return;
  socket.emit('tug', currentRoom);
  tugButton.classList.add('tug-animation');
  setTimeout(() => tugButton.classList.remove('tug-animation'), 300);
}

// Socket Handlers
socket.on('roomCreated', (roomId) => {
  currentRoom = roomId;
  isHost = true;
  roomInterface.style.display = 'block';
  document.getElementById('roomId').textContent = roomId;
  document.getElementById('hostStatus').textContent = 'You';
  startBtn.style.display = 'block';
});

socket.on('roomJoined', (data) => {
  currentRoom = data.id;
  isHost = data.isHost;
  lobbySection.style.display = 'none';
  roomInterface.style.display = 'block';
  document.getElementById('roomId').textContent = data.id;
  document.getElementById('hostStatus').textContent = isHost ? 'You' : 'Another Player';
  startBtn.style.display = isHost ? 'block' : 'none';
});

socket.on('teamJoined', (team) => {
  currentTeam = team;
  redBtn.classList.remove('selected');
  blueBtn.classList.remove('selected');
  document.getElementById(`${team}Btn`).classList.add('selected');
  tugButton.style.display = 'block';
  tugButton.style.background = team === 'red' 
    ? 'linear-gradient(45deg, #ff4444, #cc0000)' 
    : 'linear-gradient(45deg, #4444ff, #0000cc)';
});

socket.on('teamUpdate', (counts) => {
  document.getElementById('redCount').textContent = counts.red;
  document.getElementById('blueCount').textContent = counts.blue;
});

socket.on('gameStarted', (gameState) => {
  roomInterface.style.display = 'none';
  gameContainer.style.display = 'block';
  document.getElementById('marker').style.left = `${gameState.ropePosition}%`;
  tugButton.style.display = 'block';
});

socket.on('update', (gameState) => {
  document.getElementById('marker').style.left = `${gameState.ropePosition}%`;
  document.getElementById('redScore').textContent = 
    Math.floor(50 - gameState.ropePosition);
  document.getElementById('blueScore').textContent = 
    Math.floor(gameState.ropePosition - 50);
});

socket.on('gameOver', (winner) => {
  alert(`${winner.toUpperCase()} TEAM WINS!`);
  gameContainer.style.display = 'none';
  roomInterface.style.display = 'block';
  tugButton.style.display = 'none';
  if (isHost) startBtn.style.display = 'block';
});

socket.on('invalidRoom', () => alert('Room not found!'));
socket.on('roomFull', () => alert('Room is full!'));

// Initialize
document.getElementById('roomCode').addEventListener('input', function(e) {
  this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});