const express = require("express");
const { storage } = require("../services/storage");
const { deleteMessage, bulkDeleteMessages } = require("../services/discord");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const logger = require("../utils/logger");

const router = express.Router();

// GET /files - List Files (auth optional - guests see public only)
router.get("/", optionalAuth, async (req, res) => {
  try {
    const folderId = req.query.folder || null;
    let list;

    if (req.user) {
      // Logged in user - show their files
      list = await storage.list(folderId, req.user.id);
    } else {
      // Guest - show public files only
      list = await storage.listPublic(folderId);
    }

    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(list);
  } catch (err) {
    logger.error("Failed to list files:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// GET /files/public - List Public Files Only
router.get("/public", async (req, res) => {
  try {
    const folderId = req.query.folder || null;
    const list = await storage.listPublic(folderId);
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(list);
  } catch (err) {
    logger.error("Failed to list public files:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// GET /trash - List Trash Files (requires auth)
router.get("/trash", requireAuth, async (req, res) => {
  try {
    const list = await storage.listTrash(req.user.id);
    list.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
    res.json(list);
  } catch (err) {
    logger.error("Failed to list trash:", err);
    res.status(500).json({ error: "Failed to list trash" });
  }
});

// GET /:filename - Get Full Metadata (Raw)
router.get("/:filename", async (req, res) => {
  try {
    const file = await storage.get(req.params.filename);
    if (!file) return res.status(404).json({ error: "File not found" });
    res.json(file);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve file" });
  }
});

// DELETE /folder - Delete Folder Recursively
router.delete("/folder", async (req, res) => {
  const { folderPath } = req.body;

  if (!folderPath || folderPath === "/") {
    return res.status(400).json({ error: "Invalid folder path" });
  }

  logger.log(`[${req.id}] [DELETE FOLDER] Starting bulk deletion for: ${folderPath}`);

  try {
    // 1. Get all files in this folder or subfolders
    const { data: filesToDelete, error: filesError } = await storage.supabase
      .from("files")
      .select("id, name")
      .or(`folder_id.eq.${folderPath},folder_id.ilike.${folderPath}%`);

    if (filesError) throw filesError;
    if (!filesToDelete || filesToDelete.length === 0) return res.status(200).json({ status: "done", count: 0 });

    const fileIds = filesToDelete.map(f => f.id);
    const { data: chunksToDelete } = await storage.supabase
      .from("chunks")
      .select("message_id, url")
      .in("file_id", fileIds);

    // 2. Delete from Discord in batches
    if (chunksToDelete && chunksToDelete.length > 0) {
      const messageIds = chunksToDelete.map(chunk => {
        if (chunk.message_id) return chunk.message_id;
        if (chunk.url) {
          const match = chunk.url.match(/attachments\/\d+\/(\d+)\//);
          return match ? match[1] : null;
        }
        return null;
      }).filter(Boolean);

      await bulkDeleteMessages(messageIds);
    }

    // 3. Delete from Supabase
    await storage.supabase.from("files").delete().in("id", fileIds);

    res.status(200).json({ status: "done", count: filesToDelete.length });
  } catch (err) {
    logger.error(`[${req.id}] [DELETE FOLDER] failure:`, err.message);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /:filename - Soft Delete File (requires auth)
router.delete("/:filename", requireAuth, async (req, res) => {
  const filename = req.params.filename;
  try {
    const metadata = await storage.get(filename, req.user.id);
    if (!metadata) return res.status(404).json({ error: "Not found" });

    // Soft delete only - do not delete from Discord yet
    await storage.delete(filename, req.user.id);
    res.status(200).json({ status: "deleted" });
  } catch (err) {
    logger.error(`[${req.id}] Delete File failure:`, err.message);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /:filename/restore - Restore File (requires auth)
router.post("/:filename/restore", requireAuth, async (req, res) => {
  const filename = req.params.filename;
  try {
    await storage.restore(filename, req.user.id);
    res.status(200).json({ status: "restored" });
  } catch (err) {
    logger.error(`[${req.id}] Restore File failure:`, err.message);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /:filename/permanent - Permanently Delete File (requires auth)
router.delete("/:filename/permanent", requireAuth, async (req, res) => {
  const filename = req.params.filename;
  try {
    // We need to get the file even if it is deleted (soft deleted files are hidden from get() usually?)
    // Wait, storage.get() filters by name. It doesn't check deleted_at unless we added that check.
    // Let's check storage.js get() implementation.
    // It does NOT check deleted_at. So we can still get it. Good.

    const metadata = await storage.get(filename, req.user.id);
    if (!metadata) return res.status(404).json({ error: "Not found" });

    if (metadata.chunks) {
      const messageIds = metadata.chunks.map(c => c.messageId).filter(Boolean);
      await bulkDeleteMessages(messageIds);
    }

    await storage.permanentDelete(filename, req.user.id);
    res.status(200).json({ status: "permanently_deleted" });
  } catch (err) {
    logger.error(`[${req.id}] Permanent Delete File failure:`, err.message);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /:filename/rename - Rename File (requires auth)
router.patch("/:filename/rename", requireAuth, async (req, res) => {
  const { newName } = req.body;
  const filename = req.params.filename;

  if (!newName || newName.trim() === "") {
    return res.status(400).json({ error: "New name is required" });
  }

  try {
    // Check if new name already exists for this user
    const existing = await storage.get(newName, req.user.id);
    if (existing) {
      return res.status(409).json({ error: "A file with this name already exists" });
    }

    const result = await storage.rename(filename, newName.trim(), req.user.id);
    logger.log(`[${req.id}] Renamed: ${filename} -> ${newName}`);
    res.json({ status: "renamed", file: result });
  } catch (err) {
    logger.error(`[${req.id}] Rename failure:`, err.message);
    res.status(500).json({ error: "Failed to rename file" });
  }
});

// PATCH /:filename/move - Move File to Different Folder (requires auth)
router.patch("/:filename/move", requireAuth, async (req, res) => {
  const { targetFolder } = req.body;
  const filename = req.params.filename;

  if (targetFolder === undefined) {
    return res.status(400).json({ error: "Target folder is required" });
  }

  try {
    const result = await storage.move(filename, targetFolder, req.user.id);
    logger.log(`[${req.id}] Moved: ${filename} -> ${targetFolder}`);
    res.json({ status: "moved", file: result });
  } catch (err) {
    logger.error(`[${req.id}] Move failure:`, err.message);
    res.status(500).json({ error: "Failed to move file" });
  }
});

// POST /:filename/copy - Copy/Duplicate File (requires auth)
router.post("/:filename/copy", requireAuth, async (req, res) => {
  const filename = req.params.filename;
  const { newName, targetFolder } = req.body;

  try {
    // Generate copy name if not provided
    const ext = filename.includes(".") ? "." + filename.split(".").pop() : "";
    const baseName = filename.replace(ext, "");
    const copyName = newName || `${baseName} (copy)${ext}`;

    // Ensure unique name
    let finalName = copyName;
    let counter = 1;
    while (await storage.get(finalName, req.user.id)) {
      finalName = newName ? `${newName.replace(ext, "")} (${counter})${ext}` : `${baseName} (copy ${counter})${ext}`;
      counter++;
    }

    const result = await storage.copy(filename, finalName, targetFolder, req.user.id);
    logger.log(`[${req.id}] Copied: ${filename} -> ${finalName}`);
    res.json({ status: "copied", file: result });
  } catch (err) {
    logger.error(`[${req.id}] Copy failure:`, err.message);
    res.status(500).json({ error: "Failed to copy file" });
  }
});

// GET /:filename/share - Generate Share Link (requires auth)
router.get("/:filename/share", requireAuth, async (req, res) => {
  const filename = req.params.filename;

  try {
    const file = await storage.get(filename, req.user.id);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Generate share link (using the download endpoint)
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const shareUrl = `${baseUrl}/download/${encodeURIComponent(filename)}`;
    const downloadUrl = `${shareUrl}?download=true`;

    res.json({
      status: "success",
      shareUrl,
      downloadUrl,
      filename: file.name,
      size: file.size,
      type: file.type
    });
  } catch (err) {
    logger.error(`[${req.id}] Share link failure:`, err.message);
    res.status(500).json({ error: "Failed to generate share link" });
  }
});

// POST /bulk/delete - Bulk Delete Files (requires auth)
router.post("/bulk/delete", requireAuth, async (req, res) => {
  const { filenames } = req.body;

  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: "Filenames array is required" });
  }

  logger.log(`[${req.id}] Bulk delete started for ${filenames.length} files`);

  try {
    let deletedCount = 0;
    let failedCount = 0;

    for (const filename of filenames) {
      try {
        const metadata = await storage.get(filename);
        if (metadata && metadata.chunks) {
          const messageIds = metadata.chunks.map(c => c.messageId).filter(Boolean);
          await bulkDeleteMessages(messageIds);
        }
        await storage.delete(filename);
        deletedCount++;
      } catch (err) {
        logger.error(`[${req.id}] Failed to delete ${filename}:`, err.message);
        failedCount++;
      }
    }

    res.json({ status: "done", deleted: deletedCount, failed: failedCount });
  } catch (err) {
    logger.error(`[${req.id}] Bulk delete failure:`, err.message);
    res.status(500).json({ error: "Bulk delete failed" });
  }
});

// POST /bulk/move - Bulk Move Files (requires auth)
router.post("/bulk/move", requireAuth, async (req, res) => {
  const { filenames, targetFolder } = req.body;

  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: "Filenames array is required" });
  }

  if (targetFolder === undefined) {
    return res.status(400).json({ error: "Target folder is required" });
  }

  try {
    const result = await storage.bulkMove(filenames, targetFolder);
    logger.log(`[${req.id}] Bulk moved ${filenames.length} files to ${targetFolder}`);
    res.json({ status: "moved", count: result.length });
  } catch (err) {
    logger.error(`[${req.id}] Bulk move failure:`, err.message);
    res.status(500).json({ error: "Bulk move failed" });
  }
});

// PATCH /:filename/visibility - Toggle Public/Private
router.patch("/:filename/visibility", requireAuth, async (req, res) => {
  const { isPublic } = req.body;
  const filename = req.params.filename;

  if (typeof isPublic !== "boolean") {
    return res.status(400).json({ error: "isPublic must be a boolean" });
  }

  try {
    // Check file ownership
    const file = await storage.get(filename);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (file.user_id !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Admin can toggle any file, regular users only their own
    const userIdForStorage = req.user.isAdmin ? null : req.user.id;
    const result = await storage.toggleVisibility(filename, isPublic, userIdForStorage);
    logger.log(`[${req.id}] Visibility: ${filename} -> ${isPublic ? "public" : "private"}`);
    res.json({ status: "updated", isPublic: result.is_public });
  } catch (err) {
    logger.error(`[${req.id}] Visibility toggle failure:`, err.message);
    res.status(500).json({ error: "Failed to update visibility" });
  }
});

// POST /folder/move - Move Folder (requires auth)
router.post("/folder/move", requireAuth, async (req, res) => {
  const { sourcePath, targetPath } = req.body;

  if (!sourcePath || !targetPath) {
    return res.status(400).json({ error: "Source and target paths are required" });
  }

  // Prevent moving into itself
  if (targetPath.startsWith(sourcePath)) {
    return res.status(400).json({ error: "Cannot move folder into itself" });
  }

  try {
    const result = await storage.moveFolder(sourcePath, targetPath, req.user.id);
    logger.log(`[${req.id}] Moved Folder: ${sourcePath} -> ${targetPath} (${result.count} files)`);
    res.json({ status: "moved", count: result.count });
  } catch (err) {
    logger.error(`[${req.id}] Move Folder failure:`, err.message);
    res.status(500).json({ error: "Failed to move folder" });
  }
});

module.exports = router;

