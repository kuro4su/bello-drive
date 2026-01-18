const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Verify JWT token and extract user
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            isAdmin: user.is_admin
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
};

/**
 * Middleware: Require authentication
 */
const requireAuth = (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "");
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const user = verifyToken(token);

    if (!user) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    next();
};

/**
 * Middleware: Optional authentication
 */
const optionalAuth = (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.replace("Bearer ", "");
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (token) {
        req.user = verifyToken(token);
    } else {
        req.user = null;
    }

    next();
};

/**
 * Middleware: Require admin
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }

    if (!req.user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
    }

    next();
};

module.exports = {
    verifyToken,
    generateToken,
    requireAuth,
    optionalAuth,
    requireAdmin,
    JWT_SECRET
};
