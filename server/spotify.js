const axios = require('axios');

/**
 * Returns search results for a given string from the Spotify Web API.
 */
async function searchTracks(query, token) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: query,
        type: 'track',
        limit: 10
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data.tracks.items;
  } catch (error) {
    console.error('Spotify Search Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Sends a PUT request to the host's active device to play a specific track.
 */
async function playTrack(trackUri, token) {
  try {
    const response = await axios.put('https://api.spotify.com/v1/me/player/play', 
      {
        uris: [trackUri]
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Spotify Play Error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  searchTracks,
  playTrack
};
