// backend/middleware/cache.js
// In-memory cache using node-cache — no Redis server required
// Falls back to no-caching if node-cache is unavailable
import NodeCache from "node-cache";

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL) || 300; // 5 minutes

// Main cache store
const cache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 60,       // Check for expired keys every 60s
  useClones: false,      // Better performance — return references
  maxKeys: 500,          // Max 500 cached keys to prevent memory bloat
  deleteOnExpire: true,
});

// Cache statistics
let stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,
};

/**
 * Get cache stats (for health endpoint)
 */
export const getCacheStats = () => ({
  ...stats,
  keyCount: cache.keys().length,
  hitRate: stats.hits + stats.misses > 0
    ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) + "%"
    : "0%",
});

/**
 * Get a cached value by key
 */
export const cacheGet = (key) => {
  const value = cache.get(key);
  if (value !== undefined) {
    stats.hits++;
    return value;
  }
  stats.misses++;
  return null;
};

/**
 * Set a cache value with optional TTL (seconds)
 */
export const cacheSet = (key, value, ttl = DEFAULT_TTL) => {
  stats.sets++;
  cache.set(key, value, ttl);
};

/**
 * Delete cached values by key or prefix
 */
export const cacheInvalidate = (keyOrPrefix) => {
  const allKeys = cache.keys();
  const toDelete = allKeys.filter(k => k === keyOrPrefix || k.startsWith(keyOrPrefix));
  if (toDelete.length > 0) {
    cache.del(toDelete);
    stats.invalidations += toDelete.length;
  }
};

/**
 * Clear the entire cache
 */
export const cacheClear = () => {
  cache.flushAll();
};

/**
 * Express middleware factory — wraps a route with caching
 * Usage: router.get("/products", cacheMiddleware("products", 300), handler)
 * @param {string} keyPrefix - Cache key prefix
 * @param {number} ttl - Time to live in seconds (default: env CACHE_TTL)
 */
export const cacheMiddleware = (keyPrefix, ttl = DEFAULT_TTL) => {
  return (req, res, next) => {
    // Build a unique cache key from prefix + query params
    const queryStr = JSON.stringify(req.query);
    const cacheKey = `${keyPrefix}:${queryStr}`;

    const cached = cacheGet(cacheKey);
    if (cached) {
      // Return cached response with cache header
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Key", keyPrefix);
      return res.json(cached);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        cacheSet(cacheKey, data, ttl);
      }
      res.setHeader("X-Cache", "MISS");
      res.setHeader("X-Cache-Key", keyPrefix);
      return originalJson(data);
    };

    next();
  };
};

/**
 * Middleware to invalidate cache keys after write operations
 * Usage: router.post("/products", invalidateCacheMiddleware("products"), handler)
 * @param {...string} prefixes - Cache key prefixes to invalidate
 */
export const invalidateCacheMiddleware = (...prefixes) => {
  return (req, res, next) => {
    // After the response is sent, invalidate the cache
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        prefixes.forEach(prefix => cacheInvalidate(prefix));
      }
      return originalJson(data);
    };
    next();
  };
};

export default cache;
