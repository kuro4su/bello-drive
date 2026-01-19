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
    if (!req.user || req.user.id !== metadata.user_id) {
      return res.status(403).send("Access denied: Private file");
    }
  }

  const fileSize = metadata.size;

  // --- REDIRECT MODE (DEFAULT): Bypass Vercel bandwidth ---
  const hasEncryption = metadata.iv || (metadata.chunks && metadata.chunks.some(c => c.iv));
  const forceStream = req.query.stream === "true";
  const canRedirect = !hasEncryption && metadata.chunks.length === 1 && !forceStream;

  if (canRedirect) {
    let discordUrl = metadata.chunks[0]?.url;

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

    if (discordUrl) {
      logger.log(`[${req.id}] Redirect: ${filename} -> Discord CDN`);
      return res.redirect(discordUrl);
    }
  }

  // --- STREAMING MODE ---
  if (metadata.chunks.length > 1) {
    logger.log(`[${req.id}] Streaming (multi-chunk): ${filename}`);
  } else if (hasEncryption) {
    logger.log(`[${req.id}] Streaming (encrypted): ${filename}`);
  }

  // Set Headers
  const disposition = req.query.download === "true" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename="${metadata.name}"`);

  const ext = metadata.name.split(".").pop().toLowerCase();
  const mimeTypes = {
    mp4: "video/mp4", mkv: "video/webm", webm: "video/webm",
    mp3: "audio/mpeg", wav: "audio/wav",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    pdf: "application/pdf", txt: "text/plain",
    zip: "application/zip", rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed", exe: "application/octet-stream",
  };
  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");

  const fileIv = metadata.iv ? Buffer.from(metadata.iv, "hex") : null;
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  // Abort flag and active streams for cleanup
  let aborted = false;
  let activeStream = null;

  req.on("close", () => {
    if (!res.writableEnded) {
      aborted = true;
      if (activeStream) {
        activeStream.destroy();
        logger.log(`[${req.id}] Stream destroyed on client disconnect`);
      }
    }
  });

  // --- Range Handling ---
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", chunksize);
    res.setHeader("Accept-Ranges", "bytes");

    let currentOffset = 0;

    try {
      for (const chunk of metadata.chunks) {
        if (aborted) break;

        const chunkStart = currentOffset;
        const chunkEnd = currentOffset + chunk.size - 1;
        currentOffset += chunk.size;

        if (chunkStart > end) break;
        if (chunkEnd < start) continue;

        const overlapStart = Math.max(start, chunkStart);
        const overlapEnd = Math.min(end, chunkEnd);
        const relativeStart = overlapStart - chunkStart;
        const relativeEnd = overlapEnd - chunkStart;

        let chunkUrl = chunk.url;
        if (!chunkUrl) continue;

        try {
          const response = await axios.get(chunkUrl, { responseType: "stream" });
          const currentIv = chunk.iv ? Buffer.from(chunk.iv, "hex") : fileIv;
          let stream = response.data;
          activeStream = stream;

          if (currentIv) {
            const decipher = crypto.createDecipheriv("aes-256-ctr", ENCRYPTION_KEY, currentIv);
            stream = stream.pipe(decipher);
            activeStream = stream;
          }

          await new Promise((resolve, reject) => {
            let streamPos = 0;

            stream.on("data", (chunkData) => {
              if (aborted) {
                stream.destroy();
                resolve();
                return;
              }

              const chunkDataLen = chunkData.length;
              const chunkDataStart = streamPos;
              const chunkDataEnd = streamPos + chunkDataLen - 1;

              const intersectStart = Math.max(chunkDataStart, relativeStart);
              const intersectEnd = Math.min(chunkDataEnd, relativeEnd);

              if (intersectStart <= intersectEnd) {
                const sliceFrom = intersectStart - chunkDataStart;
                const sliceTo = intersectEnd - chunkDataStart + 1;
                res.write(chunkData.slice(sliceFrom, sliceTo));
              }

              streamPos += chunkDataLen;
            });

            stream.on("end", resolve);
            stream.on("error", resolve);
            stream.on("close", resolve);
          });

          activeStream = null;
        } catch (err) {
          if (aborted) break;
          logger.error(`[${req.id}] Chunk stream error:`, err.message);
        }
      }
    } catch (err) {
      logger.error("Stream Error:", err.message);
    }
  } else {
    // Full Download
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Accept-Ranges", "bytes");

    try {
      for (const chunk of metadata.chunks) {
        if (aborted) break;
        if (!chunk.url) continue;

        try {
          const response = await axios.get(chunk.url, { responseType: "stream" });
          const currentIv = chunk.iv ? Buffer.from(chunk.iv, "hex") : fileIv;
          let stream = response.data;
          activeStream = stream;

          if (currentIv) {
            const decipher = crypto.createDecipheriv("aes-256-ctr", ENCRYPTION_KEY, currentIv);
            stream = stream.pipe(decipher);
            activeStream = stream;
          }

          stream.pipe(res, { end: false });

          await new Promise((resolve) => {
            stream.on("end", resolve);
            stream.on("error", resolve);
            stream.on("close", resolve);
          });

          activeStream = null;
        } catch (err) {
          if (aborted) break;
          logger.error(`[${req.id}] Full download chunk error:`, err.message);
        }
      }
    } catch (err) {
      logger.error("Download Error:", err.message);
    }
  }

  if (!aborted) res.end();
});

module.exports = router;
