const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const querystring = require('querystring');
const {
  addTrackToQueue, voteTrack, getQueue,
  createRoom, roomExists,
  setCooldown, getCooldown, checkAndSetRequestTimer, clearAllRequestTimers,
} = require('./redis');
const { searchTracks } = require('./spotify');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
  },
});

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── REST ─────────────────────────────────────────────────────────────────────

app.get('/status', (req, res) => res.json({ status: 'ok' }));

app.get('/login', (req, res) => {
  const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({ response_type: 'code', client_id: CLIENT_ID, scope, redirect_uri: REDIRECT_URI }));
});

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  if (!code) return res.status(400).json({ error: 'No code provided' });
  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify({ code, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
    });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/#token=${response.data.access_token}`);
  } catch (error) {
    console.error('Callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

app.post('/create-room', async (req, res) => {
  try {
    let code, attempts = 0;
    do { code = generateRoomCode(); attempts++; } while (await roomExists(code) && attempts < 10);
    await createRoom(code);
    console.log(`Room created: ${code}`);
    res.json({ roomCode: code });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/room/:code', async (req, res) => {
  try {
    const exists = await roomExists(req.params.code.toUpperCase());
    res.json({ exists });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check room' });
  }
});

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('join_room', async ({ roomCode, role }) => {
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = role || 'guest';
    console.log(`${socket.id} joined ${roomCode} as ${socket.data.role}`);

    try {
      const [queue, cooldown] = await Promise.all([getQueue(roomCode), getCooldown(roomCode)]);
      socket.emit('queue_updated', queue);
      socket.emit('cooldown_updated', cooldown); // Tell the guest the current cooldown value
    } catch (err) {
      console.error('Error on join:', err);
    }
  });

  socket.on('search_song', async ({ query, token }, callback) => {
    try {
      const results = await searchTracks(query, token);
      if (typeof callback === 'function') callback({ success: true, data: results });
      else socket.emit('search_results', results);
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, error: 'Search failed' });
    }
  });

  // add_to_queue — enforces cooldown per socket
  socket.on('add_to_queue', async ({ roomCode, track }) => {
    try {
      const queue = await getQueue(roomCode);
      if (queue.some(t => t.id === track.id)) {
        socket.emit('request_denied', { reason: 'already_in_queue' });
        return;
      }

      const cooldownSeconds = await getCooldown(roomCode);
      const { allowed, remainingSeconds } = await checkAndSetRequestTimer(roomCode, socket.id, cooldownSeconds);

      if (!allowed) {
        socket.emit('request_denied', { remainingSeconds });
        return;
      }

      await addTrackToQueue(roomCode, track);
      await voteTrack(roomCode, track.id, 1); // Auto-upvote new requests
      const newQueue = await getQueue(roomCode);
      io.to(roomCode).emit('queue_updated', newQueue);
    } catch (err) {
      console.error('Error adding track:', err);
    }
  });

  socket.on('vote', async ({ roomCode, trackId, increment }) => {
    try {
      await voteTrack(roomCode, trackId, increment);
      const queue = await getQueue(roomCode);
      io.to(roomCode).emit('queue_updated', queue);
    } catch (err) {
      console.error('Error voting:', err);
    }
  });

  // Host sets the cooldown — broadcasts to all room members
  socket.on('set_cooldown', async ({ roomCode, seconds }) => {
    try {
      const s = Math.max(0, parseInt(seconds, 10) || 0);
      await setCooldown(roomCode, s);
      io.to(roomCode).emit('cooldown_updated', s);
      console.log(`Room ${roomCode} cooldown set to ${s}s`);
    } catch (err) {
      console.error('Error setting cooldown:', err);
    }
  });

  // Host manually clears all active cooldown timers
  socket.on('clear_cooldowns', async ({ roomCode }) => {
    try {
      await clearAllRequestTimers(roomCode);
      io.to(roomCode).emit('cooldowns_cleared');
      console.log(`Room ${roomCode} cooldowns cleared by host`);
    } catch (err) {
      console.error('Error clearing cooldowns:', err);
    }
  });

  socket.on('disconnect', () => console.log('Disconnected:', socket.id));
});

const PORT = process.env.PORT || 8888;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
