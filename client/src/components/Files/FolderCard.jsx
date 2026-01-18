import { Folder, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

const FolderCard = ({ name, onClick, onDelete, isDeleting, onDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "folder", name }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("application/json")) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data && onDrop) {
        onDrop(data, name);
      }
    } catch (err) {
      // Not a valid internal drop
    }
  };

  return (
    <div
      onClick={!isDeleting ? onClick : undefined}
      draggable={!isDeleting}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group flex flex-col p-4 rounded-xl bg-ctp-base border transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden 
        ${isDeleting ? "opacity-70 pointer-events-none" : ""}
        ${isDragOver ? "border-ctp-blue bg-ctp-blue/10 ring-2 ring-ctp-blue/50 scale-[1.02]" : "border-ctp-surface0/20 hover:border-ctp-blue/50 hover:bg-ctp-mantle hover:-translate-y-1"}
      `}
    >
      <div className="absolute inset-x-0 bottom-0 h-1 bg-ctp-blue scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-3 rounded-lg bg-ctp-blue/10 text-ctp-blue shrink-0 group-hover:bg-ctp-blue/20 transition-colors flex items-center justify-center">
            {isDeleting ? <Loader2 size={24} className="animate-spin" /> : <Folder size={24} fill="currentColor" className="opacity-80" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ctp-text truncate group-hover:text-ctp-blue transition-colors" title={name}>
              {name}
            </h3>
            <p className="text-xs text-ctp-subtext0/60">Folder</p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(name);
          }}
          disabled={isDeleting}
          className="p-2 opacity-0 group-hover:opacity-100 text-ctp-subtext1 hover:text-ctp-red hover:bg-ctp-red/10 rounded-lg transition-all active:scale-95"
          title="Delete Folder"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default FolderCard;
