import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';

/**
 * Search component — search Spotify and add tracks to the queue.
 * Works for both hosts and guests (both have a token).
 *
 * Props:
 *   socket        — the active socket.io socket instance
 *   roomCode      — the active room identifier
 *   hostToken     — the Spotify OAuth token
 *   onTrackAdded  — optional callback fired after a track is successfully added
 */
function Search({ socket, roomCode, hostToken, onTrackAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);

  // Listen for search_results emitted by the server
  useEffect(() => {
    if (!socket) return;

    const handleResults = (tracks) => {
      setResults(tracks || []);
      setIsSearching(false);
    };

    socket.on('search_results', handleResults);
    return () => socket.off('search_results', handleResults);
  }, [socket]);

  // Debounce: emit search_song 500ms after the user stops typing
  useEffect(() => {
    if (!hostToken || !query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      socket?.emit('search_song', { query, token: hostToken });
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [query, hostToken, socket]);

  // Add a track to the queue and close the results dropdown
  const handleAdd = (track) => {
    socket?.emit('add_to_queue', { roomCode, track });
    setResults([]);
    setQuery('');
    onTrackAdded?.(track); // notify parent (e.g. GuestView to start cooldown)
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  const isHost = !!hostToken;

  return (
    <section className="relative">
      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <SearchIcon className="w-5 h-5 text-neutral-400 group-focus-within:text-green-400 transition" />
        </div>
        <input
          type="text"
          placeholder="Search for a song to add..."
          disabled={!isHost}
          className="w-full bg-neutral-800/50 border border-neutral-700 focus:border-green-500 rounded-xl py-4 pl-12 pr-10 outline-none text-white placeholder-neutral-500 transition shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* Clear button */}
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-4 flex items-center text-neutral-500 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Searching spinner hint */}
      {isSearching && (
        <p className="text-xs text-neutral-500 mt-2 ml-1 animate-pulse">Searching Spotify...</p>
      )}

      {/* Results Dropdown */}
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden max-h-80 overflow-y-auto">
          <ul className="flex flex-col divide-y divide-neutral-800">
            {results.map((track) => (
              <li
                key={track.id}
                className="flex items-center gap-3 p-3 hover:bg-neutral-800 transition"
              >
                {/* Album Art */}
                {track.album?.images?.[2]?.url ? (
                  <img
                    src={track.album.images[2].url}
                    alt={track.album.name}
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-neutral-700 shrink-0" />
                )}

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{track.name}</p>
                  <p className="text-xs text-neutral-400 truncate">
                    {track.artists?.map((a) => a.name).join(', ')}
                  </p>
                </div>

                {/* Add Button */}
                <button
                  onClick={() => handleAdd(track)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 text-black font-bold text-lg transition shadow-lg shadow-green-500/30"
                  title="Add to queue"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default Search;
