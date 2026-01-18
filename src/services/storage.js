const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const logger = require("../utils/logger");

// Use crypto.randomUUID() instead of uuid package (ESM compatibility fix)
const uuidv4 = () => crypto.randomUUID();

// Env Config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  logger.warn("⚠️ [Storage] Missing Supabase Credentials! DB will not work.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
logger.log(`[Storage] Initialized Supabase Client (${SUPABASE_URL})`);

const storage = {
  supabase,
  // Initialization is handled by createClient
  init: async () => {
    // Optional: Test connection
    const { error } = await supabase.from("files").select("id").limit(1);
    if (error) logger.error("[Storage] Connection Failed:", error.message);
    else logger.log("[Storage] Connected to Supabase! 🟢");
  },

  list: async (folderId = null, userId = null) => {
    let query = supabase.from("files").select("*").order("date", { ascending: false });

    // Filter by user if provided
    if (userId) {
      query = query.eq("user_id", userId);
    }

    // Folder filtering
    if (folderId === "root" || folderId === "/") {
      query = query.is("folder_id", null);
    } else if (folderId && folderId !== "all") {
      query = query.eq("folder_id", folderId);
    }

    // Exclude deleted files (Soft Delete)
    query = query.is("deleted_at", null);

    const { data, error } = await query;
    if (error) {
      logger.error("[Storage] List Error:", error);
      throw error;
    }

    // Map snake_case to camelCase
    return data.map(f => ({
      ...f,
      folderId: f.folder_id,
      folder: f.folder_id || "/",
      userId: f.user_id,
      isPublic: f.is_public
    }));
  },

  // List public files only (for guests)
  listPublic: async (folderId = null) => {
    let query = supabase.from("files").select("*")
      .eq("is_public", true)
      .order("date", { ascending: false });

    if (folderId === "root" || folderId === "/") {
      query = query.is("folder_id", null);
    } else if (folderId && folderId !== "all") {
      query = query.eq("folder_id", folderId);
    }

    // Exclude deleted files
    query = query.is("deleted_at", null);

    const { data, error } = await query;
    if (error) {
      logger.error("[Storage] List Public Error:", error);
      throw error;
    }

    return data.map(f => ({
      ...f,
      folderId: f.folder_id,
      folder: f.folder_id || "/",
      userId: f.user_id,
      isPublic: f.is_public
    }));
  },

  // Toggle file visibility
  toggleVisibility: async (filename, isPublic, userId) => {
    let query = supabase
      .from("files")
      .update({ is_public: isPublic })
      .eq("name", filename);

    // Only filter by user if userId provided (admin can toggle any file)
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      logger.error("[Storage] Toggle Visibility Error:", error);
      throw error;
    }
    return data;
  },

  get: async (filename, userId = null) => {
    // 1. Get File - prefer user's file if userId provided
    let query = supabase.from("files").select("*").eq("name", filename);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: files, error } = await query;

    if (error) {
      logger.error("[Storage] Get Error:", error);
      return null;
    }

    // Handle no results
    if (!files || files.length === 0) {
      // If userId was provided but no file found, try without user filter (for public files)
      if (userId) {
        const { data: publicFiles } = await supabase
          .from("files")
          .select("*")
          .eq("name", filename)
          .eq("is_public", true);

        if (publicFiles && publicFiles.length > 0) {
          return await storage._getFileWithChunks(publicFiles[0]);
        }
      }
      return null;
    }

    // Get first matching file
    const file = files[0];

    // 2. Get Chunks
    return await storage._getFileWithChunks(file);
  },

  // Internal helper to get file with chunks
  _getFileWithChunks: async (file) => {
    const { data: chunks, error: chunkError } = await supabase
      .from("chunks")
      .select("*")
      .eq("file_id", file.id)
      .order("chunk_index", { ascending: true });

    if (chunkError) {
      logger.error("[Storage] Chunk Fetch Error:", chunkError);
      return null;
    }

    return {
      ...file,
      folderId: file.folder_id,
      folder: file.folder_id || "/",
      userId: file.user_id,
      isPublic: file.is_public,
      chunks: (chunks || []).map(c => ({
        index: c.chunk_index,
        messageId: c.message_id,
        url: c.url,
        iv: c.iv,
        size: c.size
      }))
    };
  },

  save: async (metadata, requestId = "internal") => {
    // Use the atomic RPC function for transactional integrity
    const path = metadata.folderId || metadata.folder || null;
    const { error } = await supabase.rpc("save_file_with_chunks", {
      p_file_id: metadata.id,
      p_name: metadata.name,
      p_size: metadata.size,
      p_type: metadata.type,
      p_folder_id: (path === "/" || path === "root") ? null : path,
      p_iv: metadata.iv || null,
      p_date: metadata.date || new Date().toISOString(),
      p_chunks: metadata.chunks,
      p_user_id: metadata.userId || null,
      p_is_public: metadata.isPublic || false
    });

    if (error) {
      logger.error(`[${requestId}] [Storage] Atomic Save Error:`, error);
      throw error;
    }

    logger.log(`[${requestId}] [Storage] Atomic save complete for: ${metadata.name}`);

    // Increment storage usage
    if (metadata.userId) {
      await storage._updateStorageUsage(metadata.userId, metadata.size);
    }
  },

  // Helper to update storage usage
  _updateStorageUsage: async (userId, sizeDelta) => {
    try {
      // We can't use simple increment because Supabase JS client doesn't support atomic increment easily without RPC.
      // But we can use a custom RPC or just read-modify-write (less safe but okay for now).
      // BETTER: Create a simple RPC for this.
      // For now, let's use a raw query or just fetch-update.

      const { data: user } = await supabase.from("users").select("storage_used").eq("id", userId).single();
      if (user) {
        const newUsage = (parseInt(user.storage_used) || 0) + sizeDelta;
        await supabase.from("users").update({ storage_used: newUsage }).eq("id", userId);
      }
    } catch (err) {
      logger.error("[Storage] Failed to update storage usage:", err);
    }
  },

  // Check if user has enough storage
  checkStorageLimit: async (userId, newFileSize) => {
    try {
      const { data: user } = await supabase.from("users").select("storage_used, storage_limit").eq("id", userId).single();
      if (!user) return true; // Should not happen

      const used = parseInt(user.storage_used) || 0;
      const limit = parseInt(user.storage_limit) || 1073741824; // 1GB default

      return (used + newFileSize) <= limit;
    } catch (err) {
      logger.error("[Storage] Check limit error:", err);
      return true; // Fail open? Or closed? Let's fail open for now to not block users on error.
    }
  },

  delete: async (filename, userId = null) => {
    // Soft Delete: Set deleted_at to NOW()
    let query = supabase
      .from("files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("name", filename);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;

    if (error) {
      logger.error("[Storage] Soft Delete Error:", error);
      return false;
    }
    return true;
  },

  // Restore file from trash
  restore: async (filename, userId = null) => {
    let query = supabase
      .from("files")
      .update({ deleted_at: null })
      .eq("name", filename);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;

    if (error) {
      logger.error("[Storage] Restore Error:", error);
      return false;
    }
    return true;
  },

  // Permanently delete file
  permanentDelete: async (filename, userId = null) => {
    // Get file size before delete for quota update
    let size = 0;
    if (userId) {
      const { data: file } = await supabase.from("files").select("size").eq("name", filename).eq("user_id", userId).single();
      if (file) size = file.size;
    }

    let query = supabase
      .from("files")
      .delete()
      .eq("name", filename);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;

    if (error) {
      logger.error("[Storage] Permanent Delete Error:", error);
      return false;
    }

    // Decrement storage usage
    if (userId && size > 0) {
      await storage._updateStorageUsage(userId, -size);
    }
    return true;
  },

  // List trash files
  listTrash: async (userId) => {
    let query = supabase
      .from("files")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      logger.error("[Storage] List Trash Error:", error);
      throw error;
    }

    return data.map(f => ({
      ...f,
      folderId: f.folder_id,
      folder: f.folder_id || "/",
      userId: f.user_id,
      isPublic: f.is_public
    }));
  },

  // Rename a file
  rename: async (oldName, newName, userId = null) => {
    let query = supabase
      .from("files")
      .update({ name: newName })
      .eq("name", oldName);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      logger.error("[Storage] Rename Error:", error);
      throw error;
    }
    return data;
  },

  // Move file to different folder
  move: async (filename, newFolderId, userId = null) => {
    const folderId = (newFolderId === "/" || newFolderId === "root") ? null : newFolderId;
    let query = supabase
      .from("files")
      .update({ folder_id: folderId })
      .eq("name", filename);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      logger.error("[Storage] Move Error:", error);
      throw error;
    }
    return data;
  },

  // Copy file (duplicate metadata, reuse chunk URLs)
  copy: async (filename, newName, folderId = null, userId = null) => {
    // 1. Get original file with chunks
    const original = await storage.get(filename, userId);
    if (!original) throw new Error("Original file not found");

    // 2. Create new file with same chunks but new ID
    const newId = uuidv4();
    const targetFolder = (folderId === "/" || folderId === "root") ? null : (folderId || original.folder_id);

    const { error } = await supabase.rpc("save_file_with_chunks", {
      p_file_id: newId,
      p_name: newName,
      p_size: original.size,
      p_type: original.type,
      p_folder_id: targetFolder,
      p_iv: original.iv || null,
      p_date: new Date().toISOString(),
      p_chunks: original.chunks.map(c => ({
        index: c.index,
        messageId: c.messageId,
        url: c.url,
        iv: c.iv,
        size: c.size
      })),
      p_user_id: userId,
      p_is_public: original.is_public || false
    });

    if (error) {
      logger.error("[Storage] Copy Error:", error);
      throw error;
    }

    return { id: newId, name: newName };
  },

  // Get file by ID
  getById: async (fileId) => {
    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (error || !file) return null;

    const { data: chunks } = await supabase
      .from("chunks")
      .select("*")
      .eq("file_id", file.id)
      .order("chunk_index", { ascending: true });

    return {
      ...file,
      folderId: file.folder_id,
      folder: file.folder_id || "/",
      chunks: (chunks || []).map(c => ({
        index: c.chunk_index,
        messageId: c.message_id,
        url: c.url,
        iv: c.iv,
        size: c.size
      }))
    };
  },

  // Bulk move files
  bulkMove: async (filenames, newFolderId) => {
    const folderId = (newFolderId === "/" || newFolderId === "root") ? null : newFolderId;
    const { data, error } = await supabase
      .from("files")
      .update({ folder_id: folderId })
      .in("name", filenames)
      .select();

    if (error) {
      logger.error("[Storage] Bulk Move Error:", error);
      throw error;
    }
    return data;
  },

  // Move folder (recursive)
  moveFolder: async (sourcePath, targetPath, userId = null) => {
    // 1. Get all files in the source folder (and subfolders)
    let query = supabase
      .from("files")
      .select("id, name, folder_id")
      .or(`folder_id.eq.${sourcePath},folder_id.ilike.${sourcePath}%`);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: files, error } = await query;

    if (error) {
      logger.error("[Storage] Move Folder List Error:", error);
      throw error;
    }

    if (!files || files.length === 0) return { count: 0 };

    // 2. Update each file's folder_id
    const updates = files.map(file => {
      const oldFolder = file.folder_id;
      // Replace the start of the path
      // sourcePath: /A/
      // targetPath: /B/A/
      // oldFolder: /A/Sub/
      // newFolder: /B/A/Sub/

      // Ensure sourcePath ends with / for replacement to be safe
      const safeSource = sourcePath.endsWith("/") ? sourcePath : sourcePath + "/";

      // If moving to root, targetPath might be just "/" or null?
      // targetPath passed here should be the DESTINATION folder path + The Folder Name itself.
      // E.g. Moving "Docs" (from root) to "Work".
      // sourcePath = "/Docs/"
      // targetPath = "/Work/Docs/"

      let newFolder = oldFolder.replace(safeSource, targetPath);

      return {
        id: file.id,
        folder_id: newFolder,
        name: file.name // Required for upsert? No, just update.
      };
    });

    // 3. Perform Bulk Update
    // Supabase doesn't have a simple "bulk update with different values" without upsert.
    // We can use upsert if we include all required fields, but that's risky.
    // Or we can loop. For now, let's loop (not atomic, but easiest).
    // Optimization: Create a Postgres function for this.

    let movedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("files")
        .update({ folder_id: update.folder_id })
        .eq("id", update.id);

      if (!updateError) movedCount++;
    }

    return { count: movedCount };
  }
};

module.exports = { storage, DB_TYPE: "supabase" };
