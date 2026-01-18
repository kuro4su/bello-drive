const express = require("express");
const bcrypt = require("bcryptjs");
const { storage } = require("../services/storage");
const { generateToken, requireAuth } = require("../middleware/auth");
const logger = require("../utils/logger");

const router = express.Router();

// POST /auth/register - Create new user
router.post("/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    try {
        // Check if username exists
        const { data: existing } = await storage.supabase
            .from("users")
            .select("id")
            .eq("username", username.toLowerCase())
            .single();

        if (existing) {
            return res.status(409).json({ error: "Username already taken" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const { data: user, error } = await storage.supabase
            .from("users")
            .insert({
                username: username.toLowerCase(),
                password: hashedPassword,
                is_admin: false
            })
            .select("id, username, is_admin, created_at")
            .single();

        if (error) {
            logger.error("[Auth] Register error:", error);
            return res.status(500).json({ error: "Failed to create user" });
        }

        // Generate token
        const token = generateToken(user);

        logger.log(`[Auth] New user registered: ${username}`);

        res.status(201).json({
            status: "success",
            user: {
                id: user.id,
                username: user.username,
                isAdmin: user.is_admin
            },
            token
        });
    } catch (err) {
        logger.error("[Auth] Register error:", err.message);
        res.status(500).json({ error: "Registration failed" });
    }
});

// POST /auth/login - Login user
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        // Find user
        const { data: user, error } = await storage.supabase
            .from("users")
            .select("*")
            .eq("username", username.toLowerCase())
            .single();

        if (error || !user) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        // Generate token
        const token = generateToken(user);

        logger.log(`[Auth] User logged in: ${username}`);

        res.json({
            status: "success",
            user: {
                id: user.id,
                username: user.username,
                isAdmin: user.is_admin
            },
            token
        });
    } catch (err) {
        logger.error("[Auth] Login error:", err.message);
        res.status(500).json({ error: "Login failed" });
    }
});

// GET /auth/me - Get current user info
router.get("/me", requireAuth, async (req, res) => {
    try {
        const { data: user, error } = await storage.supabase
            .from("users")
            .select("id, username, is_admin, created_at, avatar_url, bio, storage_used, storage_limit")
            .eq("id", req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            id: user.id,
            username: user.username,
            isAdmin: user.is_admin,
            createdAt: user.created_at,
            avatarUrl: user.avatar_url,
            bio: user.bio,
            storageUsed: user.storage_used || 0,
            storageLimit: user.storage_limit || 1073741824
        });
    } catch (err) {
        logger.error("[Auth] Get user error:", err.message);
        res.status(500).json({ error: "Failed to get user info" });
    }
});

// PATCH /auth/profile - Update profile
router.patch("/profile", requireAuth, async (req, res) => {
    const { avatarUrl, bio } = req.body;

    try {
        const { data: user, error } = await storage.supabase
            .from("users")
            .update({
                avatar_url: avatarUrl,
                bio: bio
            })
            .eq("id", req.user.id)
            .select("id, username, is_admin, created_at, avatar_url, bio, storage_used, storage_limit")
            .single();

        if (error) throw error;

        res.json({
            status: "success",
            user: {
                id: user.id,
                username: user.username,
                isAdmin: user.is_admin,
                createdAt: user.created_at,
                avatarUrl: user.avatar_url,
                bio: user.bio,
                storageUsed: user.storage_used || 0,
                storageLimit: user.storage_limit || 1073741824
            }
        });
    } catch (err) {
        logger.error("[Auth] Update profile error:", err.message);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

// PATCH /auth/password - Change password
router.patch("/password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password required" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    try {
        // Get current password hash
        const { data: user, error } = await storage.supabase
            .from("users")
            .select("password")
            .eq("id", req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        const { error: updateError } = await storage.supabase
            .from("users")
            .update({ password: hashedPassword })
            .eq("id", req.user.id);

        if (updateError) throw updateError;

        res.json({ status: "success", message: "Password updated successfully" });
    } catch (err) {
        logger.error("[Auth] Change password error:", err.message);
        res.status(500).json({ error: "Failed to update password" });
    }
});

// POST /auth/avatar - Upload avatar image
router.post("/avatar", requireAuth, (req, res) => {
    const busboy = require("busboy");
    const crypto = require("crypto");
    const { uploadBuffer } = require("../services/discord");

    // Env
    const RAW_KEY = process.env.ENCRYPTION_KEY || "default_secret_key";
    const ENCRYPTION_KEY = crypto.createHash("sha256").update(String(RAW_KEY)).digest();

    const bb = busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
    let fileBuffer = null;
    let fileType = null;

    bb.on("file", (name, file, info) => {
        if (!info.mimeType.startsWith("image/")) {
            return res.status(400).json({ error: "Only image files are allowed" });
        }
        fileType = info.mimeType;
        const chunks = [];
        file.on("data", (data) => chunks.push(data));
        file.on("end", () => {
            fileBuffer = Buffer.concat(chunks);
        });
    });

    bb.on("finish", async () => {
        if (!fileBuffer) return res.status(400).json({ error: "No file provided" });

        try {
            // 1. Encrypt
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv("aes-256-ctr", ENCRYPTION_KEY, iv);
            const encryptedChunk = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

            // 2. Upload to Discord
            const filename = `avatar_${req.user.id}_${Date.now()}.bin`;
            const { id, url } = await uploadBuffer(encryptedChunk, filename);

            // 3. Save File Metadata (Public)
            const fileId = crypto.randomUUID();
            const avatarFilename = `avatar_${Date.now()}.${fileType.split("/")[1]}`;

            const metadata = {
                id: fileId,
                name: avatarFilename,
                size: fileBuffer.length,
                type: fileType,
                date: new Date().toISOString(),
                folder: null, // Hidden from file browser
                folderId: null,
                chunks: [{
                    index: 0,
                    messageId: id,
                    url: url,
                    iv: iv.toString("hex"),
                    size: fileBuffer.length
                }],
                userId: req.user.id,
                isPublic: true // Avatars must be public
            };

            await storage.save(metadata, "AVATAR_UPLOAD");

            // 4. Update User Profile
            const avatarUrl = `${process.env.API_URL || "http://localhost:3000"}/download/${avatarFilename}`;

            const { data: user, error } = await storage.supabase
                .from("users")
                .update({ avatar_url: avatarUrl })
                .eq("id", req.user.id)
                .select("id, username, is_admin, created_at, avatar_url, bio, storage_used, storage_limit")
                .single();

            if (error) throw error;

            res.json({
                status: "success",
                user: {
                    id: user.id,
                    username: user.username,
                    isAdmin: user.is_admin,
                    createdAt: user.created_at,
                    avatarUrl: user.avatar_url,
                    bio: user.bio,
                    storageUsed: user.storage_used || 0,
                    storageLimit: user.storage_limit || 1073741824
                }
            });

        } catch (err) {
            logger.error("[Auth] Avatar upload error:", err);
            res.status(500).json({ error: "Failed to upload avatar" });
        }
    });

    req.pipe(bb);
});

module.exports = router;
