// backend/middleware/auth.js
import { extractToken, verifyAccessToken, verifyAdminToken } from "../utils/jwt.js";

/**
 * Require a valid user JWT.
 * Sets req.user = decoded payload on success.
 */
export const requireAuth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required. Please log in." });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Token is invalid or expired. Please log in again." });
  }

  req.user = decoded;
  next();
};

/**
 * Optional auth — sets req.user if token is valid, but doesn't block if missing.
 * Use for routes that work for both guests and logged-in users (e.g., cart, orders).
 */
export const optionalAuth = (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) req.user = decoded;
  }
  next();
};

/**
 * Require admin role — checks admin-specific JWT or user JWT with role=admin.
 */
export const requireAdmin = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Admin authentication required." });
  }

  // Try admin-specific token first
  let decoded = verifyAdminToken(token);
  if (!decoded) {
    // Fallback: check user token with admin role
    decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin privileges required." });
    }
  }

  req.user = decoded;
  next();
};

/**
 * Require user to own the resource (userId must match param or body userId).
 * Must be used after requireAuth.
 */
export const requireOwnership = (paramField = "userId") => {
  return (req, res, next) => {
    const resourceUserId = req.params[paramField] || req.body[paramField];
    if (req.user?.role === "admin") return next(); // admins can access anything
    if (!req.user || String(req.user.id) !== String(resourceUserId)) {
      return res.status(403).json({ message: "Access denied. You can only access your own resources." });
    }
    next();
  };
};
