// backend/utils/jwt.js
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "fallback_access_secret_dev";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret_dev";
const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || "fallback_admin_secret_dev";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

/**
 * Sign an access token for a regular user
 */
export const signAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
};

/**
 * Sign a refresh token for a regular user
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
};

/**
 * Sign an admin-specific token
 */
export const signAdminToken = (payload) => {
  return jwt.sign({ ...payload, role: "admin" }, ADMIN_SECRET, { expiresIn: ACCESS_EXPIRES });
};

/**
 * Verify an access token, returns decoded payload or null
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
};

/**
 * Verify a refresh token, returns decoded payload or null
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch {
    return null;
  }
};

/**
 * Verify an admin token, returns decoded payload or null
 */
export const verifyAdminToken = (token) => {
  try {
    return jwt.verify(token, ADMIN_SECRET);
  } catch {
    return null;
  }
};

/**
 * Extract token from request (Authorization header or cookie)
 */
export const extractToken = (req) => {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Then check cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};
