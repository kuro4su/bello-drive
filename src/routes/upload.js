const express = require("express");
const router = express.Router();
const axios = require("axios");
const busboy = require("busboy");
const crypto = require("crypto");
const { storage, DB_TYPE } = require("../services/storage");
const { uploadBuffer, bulkDeleteMessages } = require("../services/discord");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const logger = require("../utils/logger");

// Env
// Hash the simple key to get a 32-byte secure key
const RAW_KEY = process.env.ENCRYPTION_KEY || "default_secret_key";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(String(RAW_KEY)).digest();

// POST /chunk - Stateless Chunk Uploader (requires auth)
router.post("/chunk", requireAuth, (req, res) => {
  const bb = busboy({ headers: req.headers });
  let fileBuffer = null;
  let currentFile = "unknown";

  bb.on("file", (name, file, info) => {
    const originalName = info.filename; // Get original chunk name (chunk-X)
    currentFile = originalName;
    logger.log(`[${req.id}] [CHUNK] Start: ${originalName}`);
    const chunks = [];
    file.on("data", (data) => chunks.push(data));
    file.on("end", () => {
      fileBuffer = Buffer.concat(chunks);
      // Store the chunk name so we can use it in 'finish'
      req.chunkName = originalName;
    });
  });

  bb.on("finish", async () => {
    if (!fileBuffer) return res.status(400).json({ error: "No file provided" });

    try {
      // 1. Encrypt the chunk independenty
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-ctr", ENCRYPTION_KEY, iv);
      const encryptedChunk = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

      // 2. Upload to Discord
      // Use clean naming: originalChunkName_timestamp.bin
      const cleanName = (req.chunkName || "chunk").replace(/[^a-zA-Z0-9_-]/g, "");
      const discordFilename = `${cleanName}_${Date.now()}.bin`;

      const { id, url } = await uploadBuffer(encryptedChunk, discordFilename);

      logger.log(`[${req.id}] [CHUNK] Done: ${discordFilename}`);

      // 3. Return Metadata to Client
      // Client must store this and send it back in /finalize
      res.json({
        messageId: id,
        url: url,
        iv: iv.toString("hex"),
        size: fileBuffer.length, // Original plaintext size (approx)
      });
    } catch (error) {
      logger.error(`[${req.id}] Chunk Upload Error:`, error);
      res.status(500).json({ error: "Failed to upload chunk" });
    }
  });

  req.pipe(bb);
});

// POST /finalize - Metadata Generator (requires auth)
router.post("/finalize", requireAuth, express.json(), async (req, res) => {
  const { filename, chunks, totalSize, type } = req.body;

  if (!filename || !chunks || !Array.isArray(chunks)) {
    return res.status(400).json({ error: "Invalid metadata" });
  }

  // Check Storage Limit
  const hasSpace = await storage.checkStorageLimit(req.user.id, totalSize);
  if (!hasSpace) {
    return res.status(403).json({ error: "Storage limit exceeded! Upgrade your level, baka!" });
  }

  // Use Storage Service
  try {
    const metadata = {
      id: crypto.randomUUID(),
      name: filename,
      size: totalSize,
      type: type,
      date: new Date().toISOString(),
      folder: req.body.folder || "/",
      folderId: req.body.folderId || null,
      chunks: chunks,
      userId: req.user.id, // Set owner from auth
      isPublic: req.body.isPublic || false
    };

    await storage.save(metadata, req.id);

    logger.log(`[${req.id}] [FINALIZE] Saved ${filename} (${totalSize} bytes) using ${DB_TYPE}`);

    res.json({ success: true, filename });
  } catch (err) {
    logger.error("Metadata Save Error:", err);
    res.status(500).json({ error: "Failed to save metadata" });
  }
});

// DELETE /cancel - Cleanup orphaned chunks after user cancellation
router.delete("/cancel", express.json(), async (req, res) => {
  const { messageIds } = req.body;

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(200).json({ status: "nothing to clean" });
  }

  logger.log(`[${req.id}] [UPLOAD CANCEL] Cleaning up ${messageIds.length} orphaned chunks...`);

  try {
    await bulkDeleteMessages(messageIds);
    res.json({ status: "cleaned", count: messageIds.length });
  } catch (err) {
    logger.error("[UPLOAD CANCEL] Cleanup failed:", err.message);
    res.status(500).json({ error: "Cleanup partially failed" });
  }
});

module.exports = router;
