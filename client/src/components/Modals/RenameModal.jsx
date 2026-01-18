import { Edit3, X, Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const RenameModal = ({ file, onRename, onClose }) => {
    const [newName, setNewName] = useState(file?.name || "");
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef(null);

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            // Select filename without extension
            const lastDot = file.name.lastIndexOf(".");
            if (lastDot > 0) {
                inputRef.current.setSelectionRange(0, lastDot);
            } else {
                inputRef.current.select();
            }
        }
    }, [file]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newName.trim() || newName === file.name) return;

        setIsLoading(true);
        const success = await onRename(newName.trim());
        setIsLoading(false);

        if (success) {
            onClose();
        }
    };

    if (!file) return null;

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
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-ctp-blue/20 text-ctp-blue">
                            <Edit3 size={18} />
                        </div>
                        <h3 className="font-bold text-ctp-text">Rename File</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost text-ctp-subtext0 hover:bg-ctp-red/10 hover:text-ctp-red"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5">
                    <label className="text-xs text-ctp-subtext0/60 uppercase tracking-wider mb-2 block">
                        New Name
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full input bg-ctp-surface0/30 border-ctp-surface0/50 text-ctp-text focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue/30"
                        placeholder="Enter new filename"
                        disabled={isLoading}
                    />

                    <div className="flex gap-3 mt-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 btn bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text border-0"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !newName.trim() || newName === file.name}
                            className="flex-1 btn bg-ctp-blue hover:bg-ctp-blue/80 text-ctp-base border-0 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                <>
                                    <Check size={16} />
                                    Rename
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RenameModal;
