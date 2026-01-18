const express = require("express");
const { storage } = require("../services/storage");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const logger = require("../utils/logger");

const router = express.Router();

// Middleware: All admin routes require admin access
router.use(requireAuth, requireAdmin);

// GET /admin/stats - Global System Stats
router.get("/stats", async (req, res) => {
    try {
        // 1. Total Users
        const { count: userCount, error: userError } = await storage.supabase
            .from("users")
            .select("*", { count: "exact", head: true });

        if (userError) throw userError;

        // 2. Total Files & Storage
        const { data: files, error: fileError } = await storage.supabase
            .from("files")
            .select("size");

        if (fileError) throw fileError;

        const totalFiles = files.length;
        const totalStorage = files.reduce((acc, f) => acc + (f.size || 0), 0);

        res.json({
            users: userCount,
            files: totalFiles,
            storage: totalStorage
        });
    } catch (err) {
        logger.error("[Admin] Stats Error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// GET /admin/users - List All Users
router.get("/users", async (req, res) => {
    try {
        const { data: users, error } = await storage.supabase
            .from("users")
            .select("id, username, is_admin, created_at, avatar_url, storage_used, storage_limit")
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json(users);
    } catch (err) {
        logger.error("[Admin] List Users Error:", err);
        res.status(500).json({ error: "Failed to list users" });
    }
});

// PATCH /admin/users/:id/limit - Update Storage Limit
router.patch("/users/:id/limit", async (req, res) => {
    const { limit } = req.body;
    const userId = req.params.id;

    if (!limit || isNaN(limit)) {
        return res.status(400).json({ error: "Invalid limit" });
    }

    try {
        const { data, error } = await storage.supabase
            .from("users")
            .update({ storage_limit: limit })
            .eq("id", userId)
            .select()
            .single();

        if (error) throw error;

        res.json({ status: "success", user: data });
    } catch (err) {
        logger.error("[Admin] Update Limit Error:", err);
        res.status(500).json({ error: "Failed to update limit" });
    }
});

module.exports = router;
