import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";

export const useFileSystem = (api, getAuthHeaders = () => ({})) => {
  const [files, setFiles] = useState([]);
  const [view, setView] = useState("dashboard"); // dashboard | files | recent
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPath, setCurrentPath] = useState("/");
  const [activeOps, setActiveOps] = useState({ deleting: new Set(), downloading: new Set() });

  // Bulk Selection State
  const [selectedFiles, setSelectedFiles] = useState(new Set());

  // Sort State (persisted to localStorage)
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("sortBy") || "date");
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem("sortOrder") || "desc");

  const { addToast } = useToast();

  // Persist sort preferences
  useEffect(() => {
    localStorage.setItem("sortBy", sortBy);
    localStorage.setItem("sortOrder", sortOrder);
  }, [sortBy, sortOrder]);

  const refreshFiles = useCallback(() => {
    const endpoint = view === "trash" ? `${api}/files/trash` : `${api}/files`;
    fetch(endpoint, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((list) => setFiles(list))
      .catch((err) => console.error("Failed to fetch files:", err));
  }, [api, getAuthHeaders, view]);

  // Optimized Stats Calculation
  const stats = useMemo(() => {
    const size = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const types = {};
    const sizes = { image: 0, video: 0, audio: 0, other: 0 };

    files.forEach((f) => {
      const type = (f.type || "").toLowerCase();
      const ext = (f.name.split(".").pop() || "").toLowerCase();

      let cat = "other";
      if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) cat = "image";
      else if (type.startsWith("video/") || ["mp4", "mkv", "webm", "mov"].includes(ext)) cat = "video";
      else if (type.startsWith("audio/") || ["mp3", "wav", "ogg"].includes(ext)) cat = "audio";

      types[cat] = (types[cat] || 0) + 1;
      sizes[cat] = (sizes[cat] || 0) + (f.size || 0);
    });

    return { count: files.length, size, types, sizes };
  }, [files]);

  const handleDelete = async (filename) => {
    if (!confirm(`Delete ${filename}?`)) return;
    setActiveOps(prev => ({ ...prev, deleting: new Set(prev.deleting).add(filename) }));
    try {
      await fetch(`${api}/files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      addToast(`Deleted ${filename}`, "success");
      setSelectedFiles(prev => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
      refreshFiles();
    } catch (e) {
      console.error(e);
      addToast("Failed to delete file", "error");
    } finally {
      setActiveOps(prev => {
        const next = new Set(prev.deleting);
        next.delete(filename);
        return { ...prev, deleting: next };
      });
    }
  };

  const handleDownload = async (file) => {
    const filename = file.name;
    setActiveOps(prev => ({ ...prev, downloading: new Set(prev.downloading).add(filename) }));

    try {
      const headers = getAuthHeaders();
      const token = headers.Authorization ? headers.Authorization.replace("Bearer ", "") : null;
      const tokenParam = token ? `&token=${token}` : "";

      const downloadUrl = `${api}/download/${encodeURIComponent(filename)}?download=true${tokenParam}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast(`Downloading ${filename}`, "info");

      setTimeout(() => {
        setActiveOps(prev => {
          const next = new Set(prev.downloading);
          next.delete(filename);
          return { ...prev, downloading: next };
        });
      }, 2000);
    } catch (e) {
      console.error(e);
      addToast("Failed to start download", "error");
      setActiveOps(prev => {
        const next = new Set(prev.downloading);
        next.delete(filename);
        return { ...prev, downloading: next };
      });
    }
  };

  // Rename File
  const handleRename = async (filename, newName) => {
    if (!newName || newName.trim() === "" || newName === filename) return false;

    try {
      const res = await fetch(`${api}/files/${encodeURIComponent(filename)}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ newName: newName.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || "Failed to rename", "error");
        return false;
      }

      addToast(`Renamed to ${newName}`, "success");
      refreshFiles();
      return true;
    } catch (e) {
      console.error(e);
      addToast("Failed to rename file", "error");
      return false;
    }
  };

  // Move File
  const handleMove = async (filename, targetFolder) => {
    try {
      const res = await fetch(`${api}/files/${encodeURIComponent(filename)}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ targetFolder })
      });

      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || "Failed to move", "error");
        return false;
      }

      addToast(`Moved to ${targetFolder || "root"}`, "success");
      refreshFiles();
      return true;
    } catch (e) {
      console.error(e);
      addToast("Failed to move file", "error");
      return false;
    }
  };

  // Move Folder
  const handleMoveFolder = async (folderName, targetParentFolder) => {
    // sourcePath: /FolderName/ (relative to root? No, absolute path in DB)
    // We need to construct the absolute source path.
    // currentPath is where the folder IS.
    // So sourcePath = currentPath + folderName + "/"

    const sourcePath = currentPath === "/" ? `/${folderName}/` : `${currentPath}${folderName}/`;

    // targetPath is where we want it to BE.
    // targetParentFolder is the DESTINATION PARENT.
    // So targetPath = targetParentFolder + folderName + "/"
    // targetParentFolder already has trailing slash (e.g. "/Dest/")

    const targetPath = targetParentFolder === "/"
      ? `/${folderName}/`
      : `${targetParentFolder}${folderName}/`;

    if (sourcePath === targetPath) return false;

    try {
      const res = await fetch(`${api}/files/folder/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sourcePath, targetPath })
      });

      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || "Failed to move folder", "error");
        return false;
      }

      const data = await res.json();
      addToast(`Moved folder (${data.count} files)`, "success");
      refreshFiles();
      return true;
    } catch (e) {
      console.error(e);
      addToast("Failed to move folder", "error");
      return false;
    }
  };

  // Copy File
  const handleCopy = async (filename, newName = null, targetFolder = null) => {
    try {
      const res = await fetch(`${api}/files/${encodeURIComponent(filename)}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ newName, targetFolder })
      });

      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || "Failed to copy", "error");
        return false;
      }

      const data = await res.json();
      addToast(`Copied as ${data.file.name}`, "success");
      refreshFiles();
      return true;
    } catch (e) {
      console.error(e);
      addToast("Failed to copy file", "error");
      return false;
    }
  };

  // Get Share Link
  const handleShare = async (filename) => {
    try {
      const res = await fetch(`${api}/files/${encodeURIComponent(filename)}/share`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to get share link");

      const data = await res.json();
      return data;
    } catch (e) {
      console.error(e);
      addToast("Failed to get share link", "error");
      return null;
    }
  };

  // Restore File
  const handleRestore = async (filename) => {
    try {
      const res = await fetch(`${api}/files/${encodeURIComponent(filename)}/restore`, {
        method: "POST",
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error("Restore failed");

      addToast(`Restored ${filename}`, "success");
      refreshFiles();
    } catch (e) {
      console.error(e);
      addToast("Failed to restore file", "error");
    }
  };

  // Permanent Delete
  const handlePermanentDelete = async (filename) => {
    if (!confirm(`Permanently delete ${filename}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${api}/files/${encodeURIComponent(filename)}/permanent`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error("Permanent delete failed");

      addToast(`Permanently deleted ${filename}`, "success");
      refreshFiles();
    } catch (e) {
      console.error(e);
      addToast("Failed to delete file", "error");
    }
  };

  // Bulk Selection Handlers
  const toggleFileSelection = (filename, shiftKey = false) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const selectAllFiles = () => {
    const allNames = displayFiles.map(f => f.name);
    setSelectedFiles(new Set(allNames));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    const filenames = Array.from(selectedFiles);
    if (filenames.length === 0) return;

    if (!confirm(`Delete ${filenames.length} files? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${api}/files/bulk/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ filenames })
      });

      if (!res.ok) throw new Error("Bulk delete failed");

      const data = await res.json();
      addToast(`Deleted ${data.deleted} files`, "success");
      clearSelection();
      refreshFiles();
    } catch (e) {
      console.error(e);
      addToast("Failed to delete files", "error");
    }
  };

  // Bulk Move
  const handleBulkMove = async (targetFolder) => {
    const filenames = Array.from(selectedFiles);
    if (filenames.length === 0) return;

    try {
      const res = await fetch(`${api}/files/bulk/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ filenames, targetFolder })
      });

      if (!res.ok) throw new Error("Bulk move failed");

      const data = await res.json();
      addToast(`Moved ${data.count} files`, "success");
      clearSelection();
      refreshFiles();
    } catch (e) {
      console.error(e);
      addToast("Failed to move files", "error");
    }
  };

  const navigateToFolder = (folderName) => {
    const newPath = currentPath === "/" ? `/${folderName}/` : `${currentPath}${folderName}/`;
    setCurrentPath(newPath);
    clearSelection();
  };

  const createFolder = () => {
    const name = prompt("Folder Name:");
    if (name) {
      navigateToFolder(name);
    }
  };

  const handleDeleteFolder = async (folderName) => {
    const folderPath = currentPath === "/" ? `/${folderName}/` : `${currentPath}${folderName}/`;
    if (!confirm(`Deep Delete everything inside "${folderName}"? This cannot be undone.`)) return;

    setActiveOps(prev => ({ ...prev, deleting: new Set(prev.deleting).add(folderName) }));
    try {
      const res = await fetch(`${api}/files/folder`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath })
      });

      if (!res.ok) throw new Error("Delete failed");

      const data = await res.json();
      addToast(`Deleted ${folderName} (${data.count} files)`, "success");
      refreshFiles();
    } catch (e) {
      console.error(e);
      addToast("Failed to delete folder", "error");
    } finally {
      setActiveOps(prev => {
        const next = new Set(prev.deleting);
        next.delete(folderName);
        return { ...prev, deleting: next };
      });
    }
  };

  // Get all available folders for move modal
  const allFolders = useMemo(() => {
    const folders = new Set();
    folders.add("/");
    files.forEach(f => {
      const path = f.folder || "/";
      if (path !== "/") {
        // Add the folder and all parent folders
        const parts = path.split("/").filter(Boolean);
        let current = "/";
        parts.forEach(part => {
          current += part + "/";
          folders.add(current);
        });
      }
    });
    return Array.from(folders).sort();
  }, [files]);

  // Initial Load
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // Optimized Filter, Derive Folders & Apply Sorting
  const { displayFiles, displayFolders } = useMemo(() => {
    let dFiles = [];
    let dFolders = [];

    if (view === "recent") {
      dFiles = files.slice(0, 20);
    } else if (view === "trash") {
      dFiles = files; // Already filtered by backend
    } else if (view === "dashboard" || view === "files") {
      if (searchTerm) {
        dFiles = files.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
      } else {
        dFiles = files.filter((f) => (f.folder || "/") === currentPath);

        const uniqueFolders = new Set();
        files.forEach((f) => {
          const fPath = f.folder || "/";
          if (fPath.startsWith(currentPath) && fPath !== currentPath) {
            const relative = fPath.slice(currentPath.length);
            const [segment] = relative.split("/");
            if (segment) uniqueFolders.add(segment);
          }
        });
        dFolders = Array.from(uniqueFolders).sort((a, b) => a.localeCompare(b));
      }
    }

    // Apply Sorting
    dFiles = [...dFiles].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case "date":
        default:
          comparison = new Date(a.date || 0) - new Date(b.date || 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return { displayFiles: dFiles, displayFolders: dFolders };
  }, [files, view, searchTerm, currentPath, sortBy, sortOrder]);

  return {
    files,
    setFiles,
    view,
    setView,
    stats,
    searchTerm,
    setSearchTerm,
    currentPath,
    setCurrentPath,
    refreshFiles,
    handleDelete,
    handleDeleteFolder,
    handleDownload,
    navigateToFolder,
    createFolder,
    displayFiles,
    displayFolders,
    activeOps,
    // New: Bulk Selection
    selectedFiles,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    // New: File Operations
    handleRename,
    handleMove,
    handleMoveFolder,
    handleCopy,
    handleShare,
    handleBulkDelete,
    handleBulkMove,
    // New: Sorting
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    // New: All folders for move modal
    allFolders,
    // New: Trash Actions
    handleRestore,
    handlePermanentDelete,
  };
};
