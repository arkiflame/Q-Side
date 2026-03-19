const { createClient } = require('redis');

const redisClient = createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(console.error);

async function addTrackToQueue(roomCode, track) {
  const key = `queue:${roomCode}`;
  const trackString = JSON.stringify(track);
  await redisClient.zAdd(key, { score: 1, value: trackString });
  return track;
}

async function voteTrack(roomCode, trackId, increment) {
  const key = `queue:${roomCode}`;
  const queueItems = await redisClient.zRange(key, 0, -1);
  let targetMember = null;
  for (const item of queueItems) {
    const track = JSON.parse(item);
    if (track.id === trackId) { targetMember = item; break; }
  }
  if (targetMember) return await redisClient.zIncrBy(key, increment, targetMember);
  return null;
}

async function getQueue(roomCode) {
  const key = `queue:${roomCode}`;
  const items = await redisClient.zRangeWithScores(key, 0, -1, { REV: true });
  return items.map(item => ({ ...JSON.parse(item.value), votes: item.score }));
}

async function createRoom(roomCode) {
  await redisClient.set(`room:${roomCode}`, JSON.stringify({ createdAt: Date.now() }), { EX: 86400 });
}

async function roomExists(roomCode) {
  return (await redisClient.exists(`room:${roomCode}`)) === 1;
}

/** Store host-configured cooldown (in seconds) for a room. 0 = no cooldown. */
async function setCooldown(roomCode, seconds) {
  await redisClient.set(`cooldown:${roomCode}`, String(seconds));
}

/** Get current cooldown for a room (defaults to 0). */
async function getCooldown(roomCode) {
  const val = await redisClient.get(`cooldown:${roomCode}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Check if a socket is on cooldown. If not, set the cooldown timer.
 * Returns { allowed: true } or { allowed: false, remainingSeconds }.
 */
async function checkAndSetRequestTimer(roomCode, socketId, cooldownSeconds) {
  if (!cooldownSeconds || cooldownSeconds <= 0) return { allowed: true };
  const key = `lastRequest:${roomCode}:${socketId}`;
  const exists = await redisClient.exists(key);
  if (exists) {
    const ttl = await redisClient.ttl(key);
    return { allowed: false, remainingSeconds: ttl };
  }
  await redisClient.set(key, '1', { EX: cooldownSeconds });
  return { allowed: true };
}

/** Clear all active request timers for a given room */
async function clearAllRequestTimers(roomCode) {
  const pattern = `lastRequest:${roomCode}:*`;
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
}

module.exports = {
  redisClient,
  addTrackToQueue,
  voteTrack,
  getQueue,
  createRoom,
  roomExists,
  setCooldown,
  getCooldown,
  checkAndSetRequestTimer,
  clearAllRequestTimers,
};
