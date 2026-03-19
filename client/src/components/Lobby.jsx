import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Plus, LogIn, Loader2, Music } from 'lucide-react';

const SERVER_URL = 'http://127.0.0.1:8888';

/**
 * Lobby — shown after Spotify login. The user chooses to create or join a room.
 *
 * Props:
 *   token       — Spotify access token
 *   pendingRoom — optional room code pre-filled from a QR scan (?room=...)
 *   onJoin(roomCode, role) — called when ready to enter the main UI
 */
function Lobby({ token, pendingRoom, onJoin }) {
  const [joinCode, setJoinCode] = useState(pendingRoom || '');
  const [createdCode, setCreatedCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Host: create a new room
  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/create-room`, { method: 'POST' });
      const data = await res.json();
      setCreatedCode(data.roomCode);
    } catch (e) {
      setError('Could not create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // Host: enter their own room after creating
  const handleEnterAsHost = () => {
    onJoin(createdCode, 'host');
  };

  // Guest: validate and join an existing room
  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`${SERVER_URL}/room/${code}`);
      const data = await res.json();
      if (data.exists) {
        onJoin(code, 'guest');
      } else {
        setError(`Room "${code}" not found. Check the code and try again.`);
      }
    } catch (e) {
      setError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  };

  // Build the shareable room URL for the QR code
  const shareUrl = createdCode
    ? `${window.location.origin}${window.location.pathname}?room=${createdCode}`
    : '';

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Music className="w-5 h-5 text-green-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            Q-Side
          </h1>
        </div>

        <h2 className="text-2xl font-bold">What would you like to do?</h2>

        {/* ── Create Room Card ── */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-xl border border-green-500/20">
              <Plus className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">Create a Room</h3>
              <p className="text-sm text-neutral-400">Start a queue as the host</p>
            </div>
          </div>

          {!createdCode ? (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Room
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {/* Room Code */}
              <div className="text-center">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Your Room Code</p>
                <p className="text-4xl font-mono font-bold tracking-widest text-green-400">{createdCode}</p>
              </div>

              {/* QR Code */}
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={shareUrl} size={160} />
              </div>
              <p className="text-xs text-neutral-500 text-center">
                Share this QR code or the room code with your guests
              </p>

              <button
                onClick={handleEnterAsHost}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl transition"
              >
                Enter as Host →
              </button>
            </div>
          )}
        </div>

        {/* ── Join Room Card ── */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-800 rounded-xl border border-neutral-700">
              <Users className="w-5 h-5 text-neutral-300" />
            </div>
            <div>
              <h3 className="font-semibold">Join a Room</h3>
              <p className="text-sm text-neutral-400">Vote on songs as a guest</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter room code..."
              maxLength={6}
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="flex-1 bg-neutral-800 border border-neutral-700 focus:border-green-500 rounded-xl px-4 py-3 font-mono uppercase tracking-widest text-white outline-none transition placeholder-neutral-600"
            />
            <button
              onClick={handleJoin}
              disabled={loading || !joinCode.trim()}
              className="flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-xl transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Lobby;
