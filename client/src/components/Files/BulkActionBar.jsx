import { FolderInput, Trash2, X } from "lucide-react";

const BulkActionBar = ({
    selectedCount,
    onDelete,
    onMove,
    onClear
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            <div className="flex items-center gap-3 px-4 py-3 bg-ctp-base/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-ctp-surface0/30">
                {/* Counter */}
                <div className="flex items-center gap-2 pr-3 border-r border-ctp-surface0/30">
                    <div className="w-8 h-8 rounded-full bg-ctp-blue/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-ctp-blue">{selectedCount}</span>
                    </div>
                    <span className="text-sm text-ctp-subtext0">selected</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onMove}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-ctp-yellow/10 text-ctp-yellow hover:bg-ctp-yellow/20 transition-colors"
                    >
                        <FolderInput size={16} />
                        <span className="hidden sm:inline">Move</span>
                    </button>

                    <button
                        onClick={onDelete}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-ctp-red/10 text-ctp-red hover:bg-ctp-red/20 transition-colors"
                    >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline">Delete</span>
                    </button>
                </div>

                {/* Clear */}
                <button
                    onClick={onClear}
                    className="p-2 rounded-lg text-ctp-subtext0 hover:bg-ctp-surface0/50 hover:text-ctp-text transition-colors"
                    title="Clear selection"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};

export default BulkActionBar;
