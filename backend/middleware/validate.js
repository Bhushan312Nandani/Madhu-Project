// backend/middleware/validate.js
import { body, validationResult, param, query } from "express-validator";

/**
 * Check for validation errors and return 422 if any
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: "Validation failed",
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

/**
 * Sanitize a string — remove HTML tags and trim
 */
export const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  return str
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>'"]/g, "")  // Remove dangerous chars
    .trim();
};

// ─── Auth Validation Rules ───────────────────────────────────────────────────

export const validateSignup = [
  body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 60 }).withMessage("Name must be 2–60 characters")
    .escape(),
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
  body("phone")
    .trim()
    .notEmpty().withMessage("Phone is required")
    .matches(/^[+\d\s\-()]{7,20}$/).withMessage("Invalid phone number"),
  body("password")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("confirmPassword")
    .custom((val, { req }) => {
      if (val !== req.body.password) throw new Error("Passwords do not match");
      return true;
    }),
  handleValidationErrors,
];

export const validateLogin = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// ─── Order Validation Rules ───────────────────────────────────────────────────

export const validateOrder = [
  body("billing.firstName").trim().notEmpty().withMessage("First name is required").escape(),
  body("billing.streetAddress").trim().notEmpty().withMessage("Address is required").escape(),
  body("billing.city").trim().notEmpty().withMessage("City is required").escape(),
  body("billing.phone")
    .trim()
    .notEmpty().withMessage("Phone is required")
    .matches(/^[+\d\s\-()]{7,20}$/).withMessage("Invalid phone number"),
  body("billing.email")
    .trim()
    .notEmpty().withMessage("Billing email is required")
    .isEmail().withMessage("Invalid billing email"),
  body("items")
    .isArray({ min: 1 }).withMessage("Order must contain at least one item"),
  body("total")
    .isFloat({ min: 0 }).withMessage("Invalid order total"),
  handleValidationErrors,
];

// ─── Contact Validation Rules ─────────────────────────────────────────────────

export const validateContact = [
  body("name").trim().notEmpty().withMessage("Name is required").escape(),
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email"),
  body("message")
    .trim()
    .notEmpty().withMessage("Message is required")
    .isLength({ min: 10, max: 1000 }).withMessage("Message must be 10–1000 characters")
    .escape(),
  handleValidationErrors,
];

// ─── Review Validation Rules ──────────────────────────────────────────────────

export const validateReview = [
  body("rating")
    .isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("comment")
    .trim()
    .notEmpty().withMessage("Review comment is required")
    .isLength({ min: 10, max: 500 }).withMessage("Comment must be 10–500 characters")
    .escape(),
  body("productId")
    .notEmpty().withMessage("Product ID is required"),
  handleValidationErrors,
];

// ─── Product Validation Rules ─────────────────────────────────────────────────

export const validateProduct = [
  body("name").trim().notEmpty().withMessage("Product name is required").escape(),
  body("price")
    .isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  handleValidationErrors,
];

// ─── Coupon Validation Rules ──────────────────────────────────────────────────

export const validateCoupon = [
  body("code")
    .trim()
    .notEmpty().withMessage("Coupon code is required")
    .isAlphanumeric().withMessage("Coupon code must be alphanumeric")
    .isLength({ min: 3, max: 20 }).withMessage("Code must be 3–20 characters")
    .toUpperCase(),
  body("discount")
    .isFloat({ min: 1, max: 100 }).withMessage("Discount must be between 1% and 100%"),
  body("expiresAt")
    .isISO8601().withMessage("Invalid expiry date"),
  body("usageLimit")
    .optional()
    .isInt({ min: 1 }).withMessage("Usage limit must be a positive integer"),
  handleValidationErrors,
];
