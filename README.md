# Q-Side 🎵

A real-time, collaborative Spotify queue manager that democratizes event music. Q-Side allows a host to connect their Spotify playback, while guests can join a shared room via WebSockets to search the Spotify catalog, add tracks, and vote on the upcoming queue in real-time.

## 🧠 The Engineering Challenge
Standard REST APIs are insufficient for live, multi-user applications where state changes rapidly. Q-Side was built to tackle the following challenges:
* **State Synchronization:** Ensuring that when multiple users upvote a track at the exact same millisecond, the backend processes the queue order accurately without data loss or race conditions.
* **Bi-directional Communication:** Swapping standard stateless HTTP requests for persistent WebSocket connections to push instant UI updates to dozens of connected clients.
* **OAuth 2.0 Integration:** Managing the Spotify Authorization Code flow for hosts and Client Credentials flow for guests to securely interact with the Spotify Web API.

## 🛠️ Tech Stack
* **Frontend (Client):** Vanilla JavaScript, HTML5, CSS3 (Lightweight, zero-dependency UI for instant load times).
* **Backend (Server):** Node.js, Express.js.
* **Real-Time Engine:** Socket.io (WebSockets).
* **External API:** Spotify Web API.

## 🏗️ Architecture overview
The repository is strictly decoupled into two primary environments to separate the client-side UI rendering from the heavy backend state management.

```text
Q-Side/
├── client/           # Vanilla JS/CSS/HTML frontend
│   ├── index.html    # Guest & Host UI
│   ├── app.js        # Socket.io client and DOM manipulation
│   └── styles.css    # Responsive UI styling
└── server/           # Node.js backend
    ├── server.js     # Express & Socket.io initialization
    ├── auth.js       # Spotify OAuth 2.0 handlers
    └── queue.js      # In-memory real-time state management
