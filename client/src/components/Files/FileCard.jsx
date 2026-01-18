import { Archive, Download, FileImage, FileText, FileVideo, Music, Trash2, Loader2, Check } from "lucide-react";

const FileCard = ({ file, api, onDelete, onDownload, activeOps, onClick, isSelected, onSelect, onContextMenu }) => {
  const size = (file.size / 1024 / 1024).toFixed(2);
  const ext = file.type || file.name.split(".").pop().toLowerCase();

  const isDeleting = activeOps?.deleting?.has(file.name);
  const isDownloading = activeOps?.downloading?.has(file.name);
  const isLoading = isDeleting || isDownloading;

  const getIcon = () => {
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
      return { icon: <FileImage size={24} />, color: "text-ctp-sky", bg: "bg-ctp-sky/10" };
    if (["mp4", "mkv", "webm", "mov"].includes(ext))
      return { icon: <FileVideo size={24} />, color: "text-ctp-mauve", bg: "bg-ctp-mauve/10" };
    if (["mp3", "wav", "ogg"].includes(ext))
      return { icon: <Music size={24} />, color: "text-ctp-green", bg: "bg-ctp-green/10" };
    if (["zip", "rar", "7z"].includes(ext))
      return { icon: <Archive size={24} />, color: "text-ctp-yellow", bg: "bg-ctp-yellow/10" };

    return { icon: <FileText size={24} />, color: "text-ctp-text", bg: "bg-ctp-surface0/50" };
  };

  const { icon, color, bg } = getIcon();
  const dateStr = file.date
    ? new Date(file.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(e, file);
    }
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(file.name);
    }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "file", name: file.name }));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      onClick={!isLoading ? onClick : undefined}
      onContextMenu={handleContextMenu}
      draggable={!isLoading}
      onDragStart={handleDragStart}
      className={`group flex flex-col p-4 rounded-xl bg-ctp-base border transition-all duration-300 shadow-sm hover:shadow-md h-full cursor-pointer relative overflow-hidden ${isLoading ? "opacity-70 pointer-events-none" : ""
        } ${isSelected
          ? "border-ctp-blue bg-ctp-blue/5 ring-1 ring-ctp-blue/30"
          : "border-ctp-surface0/20 hover:border-ctp-blue/50 hover:bg-ctp-mantle hover:-translate-y-1"
        }`}
    >
      {/* Selection Checkbox */}
      <div
        onClick={handleCheckboxClick}
        className={`absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer z-10 ${isSelected
          ? "bg-ctp-blue border-ctp-blue"
          : "border-ctp-surface0/50 bg-ctp-base/50 opacity-0 group-hover:opacity-100"
          }`}
      >
        {isSelected && <Check size={14} className="text-ctp-base" />}
      </div>

      {/* Top: Icon + Info */}
      <div className="flex items-start gap-4 mb-3">
        <div className={`p-3 rounded-lg ${bg} ${color} shrink-0 group-hover:opacity-80 transition-opacity flex items-center justify-center`}>
          {isLoading ? <Loader2 size={24} className="animate-spin" /> : icon}
        </div>

        <div className="flex-1 min-w-0 pt-0.5 pr-6">
          <h3 className="text-sm font-bold text-ctp-text truncate mb-1 group-hover:text-ctp-blue transition-colors" title={file.name}>
            {file.name}
          </h3>
          <div className="flex flex-col gap-0.5 text-xs text-ctp-subtext0/60">
            <span className="font-mono">{size} MB</span>
            <span className="truncate">{dateStr}</span>
          </div>
        </div>
      </div>

      {/* Bottom: Actions */}
      <div className="mt-auto pt-3 border-t border-ctp-surface0/10 flex items-center justify-between gap-2">
        <span className="text-[10px] text-ctp-subtext0/40 uppercase font-bold tracking-wider truncate max-w-[40%]" title={ext.toUpperCase()}>
          {ext.toUpperCase()}
        </span>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(file);
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-ctp-blue bg-ctp-surface0 hover:bg-ctp-surface1 border border-ctp-blue/20 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {isDownloading ? "Starting..." : "Download"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.name);
            }}
            disabled={isLoading}
            className="p-1.5 text-ctp-red bg-ctp-surface0/50 hover:bg-ctp-red/10 border border-transparent hover:border-ctp-red/20 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
            title="Delete"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileCard;

