// backend/middleware/rateLimiter.js
import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Auth endpoints — strict limit to prevent brute force
 * 5 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 5,
  message: {
    status: 429,
    message: "Too many login attempts. Please try again after 15 minutes.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res, next, options) => {
    console.warn(`[RATE LIMIT] Auth limit hit from IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * General API endpoints — moderate limit
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: {
    status: 429,
    message: "Too many requests. Please slow down.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Admin endpoints — medium limit with logging
 * 60 requests per 15 minutes per IP
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 60,
  message: {
    status: 429,
    message: "Too many admin requests. Please slow down.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn(`[RATE LIMIT] Admin limit hit from IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * File upload endpoints — very strict
 * 10 uploads per hour per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 100 : 10,
  message: {
    status: 429,
    message: "Too many file uploads. Please try again later.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Contact form — prevent spam
 * 3 messages per hour per IP
 */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 3,
  message: {
    status: 429,
    message: "Too many contact messages. Please try again later.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
