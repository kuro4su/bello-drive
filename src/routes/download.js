const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
const { storage } = require("../services/storage");
const logger = require("../utils/logger");
const { optionalAuth } = require("../middleware/auth");

// Env
const RAW_KEY = process.env.ENCRYPTION_KEY || "default_secret_key";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(String(RAW_KEY)).digest();

router.get("/:filename", optionalAuth, async (req, res) => {
  const filename = req.params.filename;

  // Pass req.user.id if available to prefer user's own files
  const userId = req.user ? req.user.id : null;
  const metadata = await storage.get(filename, userId);

  if (!metadata) {
    return res.status(404).send("File not found");
  }

  // Access Control
  if (!metadata.is_public) {
    // If not public, user must be logged in and be the owner
    if (!req.user || req.user.id !== metadata.user_id) {
      return res.status(403).send("Access denied: Private file");
    }
  }

  const fileSize = metadata.size;

  // --- REDIRECT MODE: Bypass Vercel bandwidth ---
  // Use ?redirect=true to get a direct Discord URL redirect
  // Only works for non-encrypted files (no IV)
  const hasEncryption = metadata.iv || (metadata.chunks && metadata.chunks.some(c => c.iv));

  if (req.query.redirect === "true" && !hasEncryption) {
    // Get fresh Discord URL for first chunk
    let discordUrl = metadata.chunks[0]?.url;

    // Check if URL is expired and refresh if needed
    const isExpired = (url) => {
      try {
        const urlObj = new URL(url);
        const ex = urlObj.searchParams.get("ex");
        if (!ex) return false;
        const expiry = parseInt(ex, 16);
        const now = Math.floor(Date.now() / 1000);
        return now > expiry - 300;
      } catch (e) { return false; }
    };

    if (isExpired(discordUrl) && metadata.chunks[0]?.messageId) {
      try {
        const msgRes = await axios.get(
          `https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages/${metadata.chunks[0].messageId}`,
          { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
        );
        if (msgRes.data.attachments?.[0]?.url) {
          discordUrl = msgRes.data.attachments[0].url;
        }
      } catch (e) {
        logger.warn("Failed to refresh Discord URL for redirect:", e.message);
      }
    }

    // For single-chunk files, redirect directly
    if (metadata.chunks.length === 1 && discordUrl) {
      logger.log(`[${req.id}] Redirect mode: ${filename} -> Discord CDN`);
      return res.redirect(discordUrl);
    }

    // Multi-chunk files can't redirect (need streaming merge)
    // Fall through to normal streaming
    logger.log(`[${req.id}] Redirect skipped (multi-chunk file), using stream`);
  }

  // Set Headers - Simple Format
  const disposition = req.query.download === "true" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename="${metadata.name}"`);

  // Mime Type (Basic determination)
  const ext = metadata.name.split(".").pop().toLowerCase();
  const mimeTypes = {
    mp4: "video/mp4",
    mkv: "video/webm",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    pdf: "application/pdf",
    txt: "text/plain",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    exe: "application/octet-stream",
  };
  const mimeType = mimeTypes[ext] || "application/octet-stream";
  res.setHeader("Content-Type", mimeType);

  // Legacy support (File-level IV)
  const fileIv = metadata.iv ? Buffer.from(metadata.iv, "hex") : null;

  // Cache-Control for fast repeated viewing
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  // --- Range Handling ---
  const range = req.headers.range;

  if (range) {
    // Parse Range
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", chunksize);
    res.setHeader("Accept-Ranges", "bytes");

    // Stream relevant chunks
    let currentOffset = 0;

    try {
      for (const chunk of metadata.chunks) {
        const chunkStart = currentOffset;
        const chunkEnd = currentOffset + chunk.size - 1;
        currentOffset += chunk.size;

        // Optimization: Stop if we passed the range
        if (chunkStart > end) break;

        // Skip chunks before the start
        if (chunkEnd < start) continue;

        // Calculate slice relative to this chunk
        const overlapStart = Math.max(start, chunkStart);
        const overlapEnd = Math.min(end, chunkEnd);

        // Relative start/end indices within the chunk's stream
        const relativeStart = overlapStart - chunkStart;
        const relativeEnd = overlapEnd - chunkStart; // Inclusive index
        const lengthToServe = relativeEnd - relativeStart + 1;

        let chunkUrl = chunk.url;

        // --- Smart Link Refresh ---
        // Check if Discord URL is expired (signature check)
        const isExpired = (url) => {
          try {
            const urlObj = new URL(url);
            const ex = urlObj.searchParams.get("ex");
            if (!ex) return false; // No expiry, assume valid? or permanent
            // hex to epoch
            const expiry = parseInt(ex, 16);
            const now = Math.floor(Date.now() / 1000);
            return now > expiry - 300; // Refresh if within 5 mins of expiring
          } catch (e) { return false; }
        };

        if (isExpired(chunkUrl) && chunk.messageId && process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID) {
          try {
            const res = await axios.get(
              `https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages/${chunk.messageId}`,
              { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
            );
            if (res.data.attachments && res.data.attachments.length > 0) {
              chunkUrl = res.data.attachments[0].url;
              logger.log(`[DOWNLOAD] Refreshed URL for chunk ${chunk.index}`);
            }
          } catch (refreshErr) {
            logger.warn("Failed to refresh URL:", refreshErr.message);
          }
        }
        // ---------------------------

        if (!chunkUrl) continue;

        // Stream Fetch
        const response = await axios.get(chunkUrl, { responseType: "stream" });

        const currentIv = chunk.iv ? Buffer.from(chunk.iv, "hex") : fileIv;
        let stream = response.data;

        if (currentIv) {
          const decipher = crypto.createDecipheriv("aes-256-ctr", ENCRYPTION_KEY, currentIv);
          stream = stream.pipe(decipher);
        }

        // Manual Stream Processing to handle slicing
        await new Promise((resolve, reject) => {
          let streamPos = 0; // Position within this chunk's decrypted stream

          stream.on("data", (chunkData) => {
            // chunkData is a Buffer of decrypted bytes
            const chunkDataLen = chunkData.length;
            const chunkDataStart = streamPos;
            const chunkDataEnd = streamPos + chunkDataLen - 1;

            // Check if this piece of data overlaps with needed range
            // We need bytes from relativeStart to relativeEnd
            const intersectStart = Math.max(chunkDataStart, relativeStart);
            const intersectEnd = Math.min(chunkDataEnd, relativeEnd);

            if (intersectStart <= intersectEnd) {
              // Slice the relevant part from chunkData
              const sliceFrom = intersectStart - chunkDataStart;
              const sliceTo = intersectEnd - chunkDataStart + 1;
              res.write(chunkData.slice(sliceFrom, sliceTo));
            }

            streamPos += chunkDataLen;
          });

          stream.on("end", resolve);
          stream.on("error", reject);
        });
      }
    } catch (err) {
      logger.error("Stream Error:", err.message, "URL:", err.config?.url);
    }
  } else {
    // Full Download - Also Streamed
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Accept-Ranges", "bytes");

    try {
      for (const chunk of metadata.chunks) {
        if (!chunk.url) continue;

        const response = await axios.get(chunk.url, { responseType: "stream" });
        const currentIv = chunk.iv ? Buffer.from(chunk.iv, "hex") : fileIv;
        let stream = response.data;

        if (currentIv) {
          const decipher = crypto.createDecipheriv("aes-256-ctr", ENCRYPTION_KEY, currentIv);
          stream = stream.pipe(decipher);
        }

        stream.pipe(res, { end: false }); // Don't close res yet

        await new Promise((resolve, reject) => {
          stream.on("end", resolve);
          stream.on("error", reject);
        });
      }
    } catch (err) {
      logger.error("Download Error:", err.message);
    }
  }

  res.end();
});

module.exports = router;
