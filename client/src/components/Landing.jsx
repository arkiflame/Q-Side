import { Music } from 'lucide-react';

/**
 * Landing — full-screen branded page shown before the user authenticates.
 * On mount, checks for a ?room= query param (from a QR code scan) and stores
 * it so the Lobby can pre-fill the join input after login.
 *
 * Props:
 *   onTokenReady(token, pendingRoom) — called when we detect a token in the hash
 */
function Landing({ onTokenReady }) {
  // If the user was redirected back from Spotify, the token is in the hash.
  // This is handled in App.jsx on mount — Landing just shows the login button.

  // Read ?room= from the URL so we can pre-fill it after login
  const params = new URLSearchParams(window.location.search);
  const pendingRoom = params.get('room') || null;

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full text-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20">
            <Music className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            Q-Side
          </h1>
        </div>

        <p className="text-neutral-400 text-lg leading-relaxed">
          The collaborative Spotify queue.<br />
          Everyone votes. The crowd decides.
        </p>

        {/* Login CTA */}
        <a
          href="http://127.0.0.1:8888/login"
          className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-400 text-black font-bold py-4 px-8 rounded-2xl text-lg transition shadow-2xl shadow-green-500/30 hover:shadow-green-400/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          {/* Spotify icon SVG inline */}
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Login with Spotify
        </a>

        <p className="text-neutral-600 text-sm">
          {pendingRoom
            ? `You'll join room ${pendingRoom} after login.`
            : 'Create a room or join one after logging in.'}
        </p>
      </div>
    </div>
  );
}

export default Landing;
