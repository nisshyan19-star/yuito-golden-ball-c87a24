const SAVE_VERSION = 1;

function serialize(gameState) {
  return JSON.stringify({ version: SAVE_VERSION, data: gameState });
}

function deserialize(str) {
  try {
    const obj = JSON.parse(str);
    if (obj === null || typeof obj !== 'object') return null;
    if (!('data' in obj)) return null;
    return obj.data;
  } catch (e) {
    return null;
  }
}

(function (root, api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.SRPG = Object.assign(root.SRPG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, { serialize, deserialize });
