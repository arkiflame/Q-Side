import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Music } from 'lucide-react';

/**
 * Queue component — displays the real-time collaborative queue, sorted by votes.
 * Each track has Upvote / Downvote buttons. A local Set prevents a user from
 * voting on the same track more than once per session.
 *
 * Props:
 *   socket   — the active socket.io socket instance
 *   roomCode — the active room identifier
 */
function Queue({ socket, roomCode }) {
  const [queue, setQueue] = useState([]);
  // Track which trackIds this user has already voted on
  const [votedSet, setVotedSet] = useState(new Set());

  // Listen for queue_updated events from the server
  useEffect(() => {
    if (!socket) return;

    const handleQueueUpdate = (updatedQueue) => {
      // Server already returns queue sorted by score descending
      setQueue(updatedQueue || []);
    };

    socket.on('queue_updated', handleQueueUpdate);
    return () => socket.off('queue_updated', handleQueueUpdate);
  }, [socket]);

  // Emit a vote and mark the track as voted locally
  const handleVote = (trackId, increment) => {
    if (votedSet.has(trackId)) return; // duplicate-vote guard
    socket?.emit('vote', { roomCode, trackId, increment });
    setVotedSet((prev) => new Set([...prev, trackId]));
  };

  return (
    <section className="bg-neutral-800/20 border border-neutral-800 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 border-b border-neutral-800 pb-2 flex items-center gap-2">
        <Music className="w-4 h-4 text-green-400" />
        Up Next
        {queue.length > 0 && (
          <span className="ml-auto text-xs font-normal text-neutral-500">
            {queue.length} track{queue.length !== 1 ? 's' : ''}
          </span>
        )}
      </h3>

      {queue.length === 0 ? (
        <div className="text-center py-10 text-neutral-500 flex flex-col items-center gap-3">
          <Music className="w-10 h-10 opacity-20" />
          <p>The queue is empty. Search for a song to add!</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.map((track, i) => {
            const hasVoted = votedSet.has(track.id);
            return (
              <li
                key={track.id || i}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800/50 transition group border border-transparent hover:border-neutral-700"
              >
                {/* Rank */}
                <span className="text-neutral-500 font-mono text-sm w-5 text-center shrink-0">
                  {i + 1}
                </span>

                {/* Album Art */}
                {track.album?.images?.[2]?.url ? (
                  <img
                    src={track.album.images[2].url}
                    alt={track.album?.name}
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-neutral-700 shrink-0" />
                )}

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-neutral-200 truncate">
                    {track.name || 'Unknown Track'}
                  </h4>
                  <p className="text-sm text-neutral-400 truncate">
                    {track.artists?.map((a) => a.name).join(', ') ||
                      track.artist ||
                      'Unknown Artist'}
                  </p>
                </div>

                {/* Vote Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleVote(track.id, 1)}
                    disabled={hasVoted}
                    title={hasVoted ? "You've already voted" : 'Upvote'}
                    className="p-1.5 rounded-md transition text-neutral-400 hover:text-green-400 hover:bg-green-400/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>

                  <span className="text-sm font-mono w-7 text-center text-neutral-300 tabular-nums">
                    {Math.round(track.votes ?? 0)}
                  </span>

                  <button
                    onClick={() => handleVote(track.id, -1)}
                    disabled={hasVoted}
                    title={hasVoted ? "You've already voted" : 'Downvote'}
                    className="p-1.5 rounded-md transition text-neutral-400 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default Queue;
