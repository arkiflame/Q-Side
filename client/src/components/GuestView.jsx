import { useState, useEffect, useRef, useMemo } from 'react';
import TinderCard from 'react-tinder-card';
import { ChevronUp, ChevronDown, Music, CheckCircle, Plus, X, Clock } from 'lucide-react';
import Search from './Search';

/**
 * GuestView — Tinder-style swipe-to-vote queue for guests.
 * Includes a swipe-up bottom sheet for song requests with cooldown support.
 *
 * Props:
 *   socket   — active socket.io socket
 *   roomCode — the joined room code
 *   token    — guest's Spotify token (used for song search)
 */
function GuestView({ socket, roomCode, token }) {
  const [queue, setQueue] = useState([]);
  const [votedSet, setVotedSet] = useState(new Set());
  const [lastVote, setLastVote] = useState(null);
  const cardRefs = useRef({});

  // ── Search sheet state ─────────────────────────────────────────────────────
  const [showSearch, setShowSearch] = useState(false);

  // ── Cooldown state ─────────────────────────────────────────────────────────
  const [cooldownSeconds, setCooldownSeconds] = useState(0); // room setting from host
  const [cooldownEndsAt, setCooldownEndsAt] = useState(null); // timestamp when MY cooldown expires
  const [remaining, setRemaining] = useState(0); // live countdown display

  // Listen for queue updates
  useEffect(() => {
    if (!socket) return;
    const handler = (q) => setQueue(q || []);
    socket.on('queue_updated', handler);
    return () => socket.off('queue_updated', handler);
  }, [socket]);

  // Listen for cooldown setting changes from the host
  useEffect(() => {
    if (!socket) return;
    const handler = (secs) => setCooldownSeconds(secs || 0);
    socket.on('cooldown_updated', handler);
    return () => socket.off('cooldown_updated', handler);
  }, [socket]);

  // Listen for server-enforced request denial (e.g. if client clock drifted or duplicate request)
  useEffect(() => {
    if (!socket) return;
    const handler = ({ remainingSeconds, reason }) => {
      if (reason === 'already_in_queue') {
        alert('This song is already requested!');
        return;
      }
      if (remainingSeconds) {
        const endsAt = Date.now() + remainingSeconds * 1000;
        setCooldownEndsAt(endsAt);
        setShowSearch(false);
      }
    };
    socket.on('request_denied', handler);
    return () => socket.off('request_denied', handler);
  }, [socket]);

  // Listen for host clearing active cooldowns
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setCooldownEndsAt(null);
      setRemaining(0);
    };
    socket.on('cooldowns_cleared', handler);
    return () => socket.off('cooldowns_cleared', handler);
  }, [socket]);

  // Live countdown ticker
  useEffect(() => {
    if (!cooldownEndsAt) return;
    const tick = setInterval(() => {
      const left = Math.ceil((cooldownEndsAt - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        setCooldownEndsAt(null);
        clearInterval(tick);
      } else {
        setRemaining(left);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [cooldownEndsAt]);

  const isOnCooldown = cooldownEndsAt !== null && remaining > 0;

  // Called when guest successfully adds a track via the Search component
  const handleTrackAdded = (track) => {
    if (cooldownSeconds > 0) {
      setCooldownEndsAt(Date.now() + cooldownSeconds * 1000);
      setRemaining(cooldownSeconds);
    }
    if (track) {
      // Auto-hide the added track from their swipe stack (since it gets +1 auto-upvoted on server)
      setVotedSet(prev => new Set([...prev, track.id]));
    }
    setShowSearch(false);
  };

  // Format seconds as M:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Voting ─────────────────────────────────────────────────────────────────
  const unvotedTracks = useMemo(
    () => queue.filter((t) => !votedSet.has(t.id)),
    [queue, votedSet]
  );

  const currentTrack = unvotedTracks[0] || null;

  const handleVote = (increment) => {
    if (!currentTrack) return;
    const trackId = currentTrack.id;
    if (votedSet.has(trackId)) return;
    const ref = cardRefs.current[trackId];
    if (ref) ref.swipe(increment > 0 ? 'up' : 'down');
    socket?.emit('vote', { roomCode, trackId, increment });
    setVotedSet((prev) => new Set([...prev, trackId]));
    setLastVote(increment > 0 ? 'up' : 'down');
    setTimeout(() => setLastVote(null), 600);
  };

  const onSwipe = (direction, trackId) => {
    if (votedSet.has(trackId)) return;
    // Manual swipe was left or right (skip).
    // Programmatic swipe via buttons might be up/down.
    // In either case, the card is visually leaving the stack, so mark it as 'seen'
    setVotedSet((prev) => new Set([...prev, trackId]));
  };

  // ── Render: empty / all-voted states ──────────────────────────────────────

  const emptyOrAllVoted = queue.length === 0 || unvotedTracks.length === 0;

  return (
    <div className="min-h-[100dvh] bg-neutral-950 flex flex-col items-center text-white select-none overflow-hidden relative pt-6 pb-24">

      {/* Room code pill */}
      <div className="text-xs text-neutral-500 font-mono bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full z-10 shrink-0 mb-2">
        Room: {roomCode}
      </div>

      {/* ── Main voting content ─────────────────────────────────────────────── */}
      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-0 relative">
      {queue.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <Music className="w-12 h-12 text-neutral-700 animate-pulse" />
          <p className="text-neutral-400">Waiting for the host to add songs...</p>
        </div>
      ) : unvotedTracks.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle className="w-12 h-12 text-green-400" />
          <h2 className="text-2xl font-bold">All caught up! 🎵</h2>
          <p className="text-neutral-400">You've voted on every song.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-neutral-600 mb-auto mt-2">
            {unvotedTracks.length} song{unvotedTracks.length !== 1 ? 's' : ''} left to vote on
          </p>

          {/* Upvote */}
          <button
            onClick={() => handleVote(1)}
            className={`z-20 mb-6 p-5 rounded-full border-2 transition-all duration-200
              ${lastVote === 'up'
                ? 'bg-green-500 border-green-400 scale-110 shadow-2xl shadow-green-500/50'
                : 'bg-neutral-900 border-neutral-700 hover:border-green-500 hover:bg-green-500/10 hover:scale-110'
              }`}
          >
            <ChevronUp className={`w-10 h-10 transition-colors ${lastVote === 'up' ? 'text-black' : 'text-green-400'}`} />
          </button>

          {/* Card stack */}
          <div className="relative w-72 h-80">
            {unvotedTracks.slice(0, 3).reverse().map((track, idx, arr) => {
              const isTop = idx === arr.length - 1;
              const scale = 1 - (arr.length - 1 - idx) * 0.04;
              const yOffset = (arr.length - 1 - idx) * 10;
              return (
                <div key={track.id} className="absolute inset-0"
                  style={{ transform: `scale(${scale}) translateY(${yOffset}px)`, zIndex: idx }}>
                  <TinderCard
                    ref={(el) => { if (isTop && el) cardRefs.current[track.id] = el; }}
                    onSwipe={(dir) => isTop && onSwipe(dir, track.id)}
                    preventSwipe={['up', 'down']}
                    swipeRequirementType="position"
                    swipeThreshold={50}
                    className="w-full h-full"
                  >
                    <div className={`w-full h-full rounded-3xl overflow-hidden shadow-2xl border flex flex-col items-center justify-center gap-4 p-6
                      ${isTop ? 'bg-neutral-900 border-neutral-700 cursor-grab active:cursor-grabbing' : 'bg-neutral-900 border-neutral-800'}`}>
                      {track.album?.images?.[0]?.url ? (
                        <img src={track.album.images[0].url} alt={track.album.name}
                          className="w-44 h-44 rounded-2xl object-cover shadow-xl" draggable={false} />
                      ) : (
                        <div className="w-44 h-44 rounded-2xl bg-neutral-800 flex items-center justify-center">
                          <Music className="w-12 h-12 text-neutral-600" />
                        </div>
                      )}
                      {isTop && (
                        <div className="text-center">
                          <h2 className="font-bold text-lg text-white leading-snug line-clamp-1">{track.name}</h2>
                          <p className="text-sm text-neutral-400 line-clamp-1">{track.artists?.map((a) => a.name).join(', ')}</p>
                          <p className="text-xs text-neutral-600 mt-1">
                            {track.votes !== undefined ? `${Math.round(track.votes)} votes` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </TinderCard>
                </div>
              );
            })}
          </div>

          {/* Downvote */}
          <button
            onClick={() => handleVote(-1)}
            className={`z-20 mt-6 p-5 rounded-full border-2 transition-all duration-200
              ${lastVote === 'down'
                ? 'bg-red-500 border-red-400 scale-110 shadow-2xl shadow-red-500/50'
                : 'bg-neutral-900 border-neutral-700 hover:border-red-500 hover:bg-red-500/10 hover:scale-110'
              }`}
          >
            <ChevronDown className={`w-10 h-10 transition-colors ${lastVote === 'down' ? 'text-black' : 'text-red-400'}`} />
          </button>

          {/* Swipe text hint */}
          <div className="mt-auto mb-2 text-center">
            <p className="text-[10px] text-neutral-500 mb-1">
              Tap buttons to Vote
            </p>
            <p className="text-[10px] text-neutral-600 animate-pulse">
              Swipe LEFT/RIGHT to Skip
            </p>
          </div>
        </>
      )}
      </div>

      {/* ── Add Song pill button (fixed bottom) ────────────────────────────── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
        {isOnCooldown ? (
          <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 text-neutral-400 text-sm font-medium px-5 py-3 rounded-full">
            <Clock className="w-4 h-4" />
            Request in {formatTime(remaining)}
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-5 py-3 rounded-full shadow-lg shadow-green-500/30 transition hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Song
          </button>
        )}
      </div>

      {/* ── Bottom Sheet Backdrop ───────────────────────────────────────────── */}
      {showSearch && (
        <div
          className="absolute inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={() => setShowSearch(false)}
        />
      )}

      {/* ── Bottom Sheet Panel ─────────────────────────────────────────────── */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-[85vh] z-40 bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-6 flex flex-col gap-4 transition-transform duration-300 ease-out`}
        style={{ transform: showSearch ? 'translateY(0)' : 'translateY(100%)' }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Request a Song</h3>
          <button onClick={() => setShowSearch(false)}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {cooldownSeconds > 0 && (
          <p className="text-xs text-neutral-500">
            ⏱ A {formatTime(cooldownSeconds)} cooldown applies after each request.
          </p>
        )}

        {/* Search component — reuse existing Search with onAdd callback */}
        <Search
          socket={socket}
          roomCode={roomCode}
          hostToken={token}
          onTrackAdded={handleTrackAdded}
        />
      </div>
    </div>
  );
}

export default GuestView;
