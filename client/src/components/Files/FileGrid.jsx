import FileCard from "./FileCard";
import FolderCard from "./FolderCard";
import { Archive, Download, FileImage, FileText, FileVideo, Music, Trash2, Loader2, Folder, MoreVertical, Check } from "lucide-react";

const FileGrid = ({
  files,
  folders = [],
  api,
  currentPath,
  setCurrentPath,
  onDelete,
  onDownload,
  onFolderDelete,
  activeOps,
  onSelect,
  onFolderClick,
  selectedFiles,
  onFileSelect,
  onContextMenu,
  onFileDrop,
  viewMode = "grid"
}) => {

  // Helper to get icon (duplicated from FileCard for now to keep it self-contained)
  const getFileIcon = (file) => {
    const ext = file.type || file.name.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
      return { icon: <FileImage size={20} />, color: "text-ctp-sky", bg: "bg-ctp-sky/10" };
    if (["mp4", "mkv", "webm", "mov"].includes(ext))
      return { icon: <FileVideo size={20} />, color: "text-ctp-mauve", bg: "bg-ctp-mauve/10" };
    if (["mp3", "wav", "ogg"].includes(ext))
      return { icon: <Music size={20} />, color: "text-ctp-green", bg: "bg-ctp-green/10" };
    if (["zip", "rar", "7z"].includes(ext))
      return { icon: <Archive size={20} />, color: "text-ctp-yellow", bg: "bg-ctp-yellow/10" };

    return { icon: <FileText size={20} />, color: "text-ctp-text", bg: "bg-ctp-surface0/50" };
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  // --- List View Components ---

  const ListViewRow = ({ item, type, isSelected, onClick, onContextMenu, onDragStart, onDrop, isDeleting, isDownloading }) => {
    const isFolder = type === "folder";
    const { icon, color, bg } = isFolder
      ? { icon: <Folder size={20} className="fill-current" />, color: "text-ctp-blue", bg: "bg-ctp-blue/10" }
      : getFileIcon(item);

    const handleDragOver = (e) => {
      if (isFolder) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add("bg-ctp-blue/10");
      }
    };

    const handleDragLeave = (e) => {
      if (isFolder) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove("bg-ctp-blue/10");
      }
    };

    const handleDrop = (e) => {
      if (isFolder) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove("bg-ctp-blue/10");
        const data = e.dataTransfer.getData("application/json");
        if (data && onDrop) {
          onDrop(JSON.parse(data), item); // item is folder name
        }
      }
    };

    return (
      <tr
        onClick={onClick}
        onContextMenu={(e) => onContextMenu && onContextMenu(e, item)}
        draggable={!isDeleting && !isDownloading}
        onDragStart={onDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group border-b border-ctp-surface0/10 hover:bg-ctp-surface0/20 transition-colors cursor-pointer ${isSelected ? "bg-ctp-blue/5" : ""
          } ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
      >
        <td className="p-3 w-10">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect && onFileSelect(item.name || item);
            }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${isSelected
              ? "bg-ctp-blue border-ctp-blue"
              : "border-ctp-surface0/50 hover:border-ctp-blue/50"
              }`}
          >
            {isSelected && <Check size={12} className="text-ctp-base" />}
          </div>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bg} ${color}`}>
              {isDeleting || isDownloading ? <Loader2 size={20} className="animate-spin" /> : icon}
            </div>
            <span className="font-medium text-ctp-text truncate max-w-[200px] sm:max-w-xs">
              {item.name || item}
            </span>
          </div>
        </td>
        <td className="p-3 text-sm text-ctp-subtext0 hidden sm:table-cell">
          {isFolder ? "-" : formatDate(item.date)}
        </td>
        <td className="p-3 text-sm text-ctp-subtext0 hidden md:table-cell font-mono">
          {isFolder ? "-" : formatSize(item.size)}
        </td>
        <td className="p-3 text-right">
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isFolder && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(item);
                }}
                className="p-1.5 text-ctp-blue hover:bg-ctp-blue/10 rounded-lg transition-colors"
                title="Download"
              >
                <Download size={16} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                isFolder ? onFolderDelete(item) : onDelete(item.name);
              }}
              className="p-1.5 text-ctp-red hover:bg-ctp-red/10 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (viewMode === "list") {
    return (
      <div className="overflow-x-auto pb-20">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-ctp-surface0/20 text-xs font-bold text-ctp-subtext0 uppercase tracking-wider">
              <th className="p-3 w-10"></th>
              <th className="p-3">Name</th>
              <th className="p-3 hidden sm:table-cell">Date</th>
              <th className="p-3 hidden md:table-cell">Size</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Go Up Folder */}
            {currentPath && currentPath !== "/" && (
              <tr
                onClick={() => {
                  const parts = currentPath.split("/").filter(Boolean);
                  parts.pop();
                  const parentPath = parts.length > 0 ? "/" + parts.join("/") + "/" : "/";
                  setCurrentPath(parentPath);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.add("bg-ctp-blue/10");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("bg-ctp-blue/10");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("bg-ctp-blue/10");
                  const parts = currentPath.split("/").filter(Boolean);
                  parts.pop();
                  const parentPath = parts.length > 0 ? "/" + parts.join("/") + "/" : "/";
                  const data = e.dataTransfer.getData("application/json");
                  if (data && onFileDrop) {
                    onFileDrop(JSON.parse(data), parentPath);
                  }
                }}
                className="border-b border-ctp-surface0/10 hover:bg-ctp-surface0/20 transition-colors cursor-pointer"
              >
                <td className="p-3"></td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-ctp-blue/10 text-ctp-blue">
                      <Folder size={20} className="fill-current" />
                    </div>
                    <span className="font-medium text-ctp-text">..</span>
                  </div>
                </td>
                <td className="p-3" colSpan="3"></td>
              </tr>
            )}

            {/* Folders */}
            {folders.map((folder) => (
              <ListViewRow
                key={folder}
                item={folder}
                type="folder"
                isSelected={false} // Folders selection not fully implemented in grid yet?
                onClick={() => onFolderClick(folder)}
                onContextMenu={null} // Folder context menu?
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify({ type: "folder", name: folder }));
                }}
                onDrop={onFileDrop}
                isDeleting={activeOps?.deleting?.has(folder)}
              />
            ))}

            {/* Files */}
            {files.map((file) => (
              <ListViewRow
                key={file.name}
                item={file}
                type="file"
                isSelected={selectedFiles?.has(file.name)}
                onClick={() => onSelect(file)}
                onContextMenu={onContextMenu}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify({ type: "file", name: file.name }));
                }}
                isDeleting={activeOps?.deleting?.has(file.name)}
                isDownloading={activeOps?.downloading?.has(file.name)}
                onFileSelect={onFileSelect}
              />
            ))}

            {files.length === 0 && folders.length === 0 && (
              <tr>
                <td colSpan="5" className="py-12 text-center text-ctp-subtext0 opacity-50">
                  No files found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
      {/* Go Up Folder */}
      {currentPath && currentPath !== "/" && (
        <FolderCard
          name=".."
          onClick={() => {
            // Navigate to parent
            const parts = currentPath.split("/").filter(Boolean);
            parts.pop();
            const parentPath = parts.length > 0 ? "/" + parts.join("/") + "/" : "/";
            setCurrentPath(parentPath);
          }}
          isDeleting={false}
          onDrop={(data) => {
            // Drop to parent
            const parts = currentPath.split("/").filter(Boolean);
            parts.pop();
            const parentPath = parts.length > 0 ? "/" + parts.join("/") + "/" : "/";
            onFileDrop(data, parentPath);
          }}
        />
      )}

      {/* Folders First */}
      {folders.map((folder) => (
        <FolderCard
          key={folder}
          name={folder}
          onClick={() => onFolderClick(folder)}
          onDelete={onFolderDelete}
          isDeleting={activeOps?.deleting?.has(folder)}
          onDrop={onFileDrop}
        />
      ))}

      {/* Files */}
      {files.map((file) => (
        <FileCard
          key={file.name}
          file={file}
          api={api}
          onDelete={onDelete}
          onDownload={onDownload}
          activeOps={activeOps}
          onClick={() => onSelect(file)}
          isSelected={selectedFiles?.has(file.name)}
          onSelect={onFileSelect}
          onContextMenu={onContextMenu}
          onDrop={onFileDrop}
        />
      ))}

      {files.length === 0 && folders.length === 0 && (
        <div className="col-span-full py-12 flex flex-col items-center justify-center text-ctp-subtext0 opacity-50">
          <p>No files found</p>
        </div>
      )}
    </div>
  );
};

export default FileGrid;
