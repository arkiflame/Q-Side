import { useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { Play, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import Landing from './components/Landing';
import Lobby from './components/Lobby';
import Search from './components/Search';
import Queue from './components/Queue';
import GuestView from './components/GuestView';

/**
 * App — top-level state machine.
 *
 * Views:
 *   'landing' → user not yet authenticated
 *   'lobby'   → authenticated, choosing to create or join a room
 *   'host'    → in a room as the host (search + queue UI)
 *   'guest'   → in a room as a guest (swipe voting UI)
 */
function App() {
  const socket = useSocket();
  const [view, setView] = useState('landing');
  const [token, setToken] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [cooldown, setCooldown] = useState(0); // host-controlled cooldown in seconds

  // Check for Spotify token in URL hash on mount (post-OAuth redirect)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const t = params.get('token');
      if (t) {
        setToken(t);
        setView('lobby');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  // Join the socket room when we move into a host/guest view.
  // Also sync the cooldown setting from Redis when host rejoins.
  useEffect(() => {
    if (!socket || !roomCode || (view !== 'host' && view !== 'guest')) return;
    socket.emit('join_room', { roomCode, role: view });
    const handleCooldownUpdate = (secs) => setCooldown(secs || 0);
    socket.on('cooldown_updated', handleCooldownUpdate);
    return () => socket.off('cooldown_updated', handleCooldownUpdate);
  }, [socket, roomCode, view]);

  // Emit set_cooldown whenever the host changes the slider
  const handleCooldownChange = (secs) => {
    setCooldown(secs);
    socket?.emit('set_cooldown', { roomCode, seconds: secs });
  };

  // Called by Lobby when the user is ready to enter a room
  const handleJoin = (code, role) => {
    setRoomCode(code);
    setView(role); // 'host' or 'guest'
  };

  // ── Landing ──────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return <Landing />;
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (view === 'lobby') {
    const params = new URLSearchParams(window.location.search);
    return (
      <Lobby
        token={token}
        pendingRoom={params.get('room')}
        onJoin={handleJoin}
      />
    );
  }

  // ── Guest View ────────────────────────────────────────────────────────────
  if (view === 'guest') {
    return <GuestView socket={socket} roomCode={roomCode} token={token} />;
  }

  // ── Host View ─────────────────────────────────────────────────────────────
  const shareUrl = roomCode
    ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    : '';

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans p-4 sm:p-6 flex flex-col items-center">

      {/* Header */}
      <header className="w-full max-w-2xl mb-6 flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/10 backdrop-blur-md">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
          Q-Side
        </h1>

        <div className="flex items-center gap-2">
          {/* Room code */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700">
            <Wifi className="w-3 h-3 text-green-400" />
            <span className="font-mono text-white">{roomCode}</span>
          </div>

          {/* Host badge */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-400/10 px-3 py-1.5 rounded-lg border border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Host
          </div>

          {/* QR toggle */}
          <button
            onClick={() => setShowQR((v) => !v)}
            className="text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-700 transition"
          >
            {showQR ? 'Hide QR' : 'Share QR'}
          </button>
        </div>
      </header>

      {/* QR panel */}
      {showQR && (
        <div className="w-full max-w-2xl mb-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={shareUrl} size={160} />
          </div>
          <p className="text-xs text-neutral-500">
            Guests scan this to join <span className="font-mono text-white">{roomCode}</span>
          </p>
        </div>
      )}

      <main className="w-full max-w-2xl flex flex-col gap-5">

        {/* Now Playing placeholder */}
        <section className="bg-gradient-to-br from-green-900/40 to-black p-5 rounded-2xl border border-green-500/20 shadow-xl shadow-green-900/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-neutral-800 rounded-md shrink-0 border border-neutral-700 overflow-hidden">
              <div className="w-full h-full bg-neutral-700 animate-pulse" />
            </div>
            <div>
              <p className="text-xs text-green-400 font-semibold mb-0.5 uppercase tracking-wider">Now Playing</p>
              <h2 className="text-base font-bold">Waiting for host...</h2>
              <p className="text-sm text-neutral-400">Select a track to play</p>
            </div>
          </div>
          <button className="p-3.5 rounded-full bg-green-500 hover:bg-green-400 text-black transition shadow-lg shadow-green-500/30">
            <Play className="w-5 h-5 fill-current" />
          </button>
        </section>

        {/* Search */}
        <Search socket={socket} roomCode={roomCode} hostToken={token} />

        {/* Cooldown settings */}
        <section className="bg-neutral-800/20 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-200">Guest Request Cooldown</h3>
                <button
                  onClick={() => socket?.emit('clear_cooldowns', { roomCode })}
                  className="text-[10px] bg-neutral-700/50 hover:bg-neutral-600 px-2 py-0.5 rounded-md text-neutral-300 transition"
                  title="Wipe active timers for all guests"
                >
                  Clear Active Timers
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">How long guests must wait between song requests</p>
            </div>
            <span className="text-sm font-mono font-bold text-green-400 min-w-12 text-right">
              {cooldown === 0 ? 'Off' : cooldown < 60 ? `${cooldown}s` : `${Math.round(cooldown / 60)}m`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={cooldown / 60}
            onChange={(e) => handleCooldownChange(Number(e.target.value) * 60)}
            className="w-full accent-green-500"
          />
          {/* Tick marks */}
          <div className="flex justify-between w-full px-[6px] -mt-1 pointer-events-none">
            {[...Array(11)].map((_, i) => (
              <div key={i} className={`w-[2px] h-1.5 ${i === 0 || i === 5 || i === 10 ? 'bg-neutral-500' : 'bg-neutral-700'}`}></div>
            ))}
          </div>
          {/* Labels */}
          <div className="relative w-full h-4 mt-1 text-[11px] text-neutral-500 font-medium">
            <span className="absolute left-[0%]">Off</span>
            <span className="absolute left-[50%] -translate-x-1/2">5m</span>
            <span className="absolute right-[0%]">10m</span>
          </div>
        </section>

        {/* Queue */}
        <Queue socket={socket} roomCode={roomCode} />

      </main>
    </div>
  );
}

export default App;
