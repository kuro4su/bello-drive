import { Folder, FolderOpen, X } from "lucide-react";
import { useEffect, useState } from "react";

const MoveFileModal = ({ file, files = [], folders, currentPath, onMove, onClose }) => {
    const [selectedFolder, setSelectedFolder] = useState(currentPath);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    const handleMove = () => {
        if (selectedFolder !== (file.folder || "/")) {
            onMove(selectedFolder);
        }
        onClose();
    };

    // Get current file's folder
    const currentFileFolder = file.folder || "/";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-ctp-base rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-ctp-surface0/20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-ctp-surface0/20 bg-ctp-mantle/50">
                    <h3 className="font-bold text-ctp-text">Move File</h3>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost text-ctp-subtext0 hover:bg-ctp-red/10 hover:text-ctp-red"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* File Info */}
                <div className="px-5 py-3 border-b border-ctp-surface0/10 bg-ctp-mantle/20">
                    <p className="text-xs text-ctp-subtext0/60 mb-1">Moving:</p>
                    <p className="text-sm text-ctp-text truncate font-medium">{file.name}</p>
                </div>

                {/* Folder List */}
                <div className="max-h-64 overflow-y-auto p-3">
                    <p className="text-xs text-ctp-subtext0/60 uppercase tracking-wider mb-2 px-2">
                        Select Destination
                    </p>

                    <div className="space-y-1">
                        {folders.map((folder) => {
                            const isCurrentFolder = folder === currentFileFolder;
                            const isSelected = folder === selectedFolder;
                            const displayName = folder === "/" ? "Root" : folder.replace(/\//g, " / ").trim();

                            return (
                                <button
                                    key={folder}
                                    onClick={() => !isCurrentFolder && setSelectedFolder(folder)}
                                    disabled={isCurrentFolder}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${isCurrentFolder
                                            ? "opacity-40 cursor-not-allowed"
                                            : isSelected
                                                ? "bg-ctp-blue/20 border border-ctp-blue/50 text-ctp-blue"
                                                : "hover:bg-ctp-surface0/50 border border-transparent"
                                        }`}
                                >
                                    {isSelected ? (
                                        <FolderOpen size={18} className="text-ctp-blue shrink-0" />
                                    ) : (
                                        <Folder size={18} className="text-ctp-yellow shrink-0" />
                                    )}
                                    <span className="text-sm truncate flex-1">{displayName}</span>
                                    {isCurrentFolder && (
                                        <span className="text-[10px] text-ctp-subtext0/60 uppercase">Current</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-ctp-surface0/20 bg-ctp-mantle/30 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 btn bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text border-0"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleMove}
                        disabled={selectedFolder === currentFileFolder}
                        className="flex-1 btn bg-ctp-blue hover:bg-ctp-blue/80 text-ctp-base border-0 disabled:opacity-50"
                    >
                        Move Here
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveFileModal;
