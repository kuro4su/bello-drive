import { Calendar, File, FolderOpen, HardDrive, Layers, X } from "lucide-react";
import { useEffect } from "react";

const FileInfoModal = ({ file, onClose }) => {
    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    if (!file) return null;

    const formatSize = (bytes) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "Unknown";
        const date = new Date(dateStr);
        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getExt = (name) => name.split(".").pop().toLowerCase();
    const ext = getExt(file.name);

    const infoItems = [
        { icon: File, label: "File Name", value: file.name },
        { icon: HardDrive, label: "Size", value: formatSize(file.size || 0) },
        { icon: Layers, label: "Type", value: ext.toUpperCase() },
        { icon: FolderOpen, label: "Location", value: file.folder || "/" },
        { icon: Calendar, label: "Uploaded", value: formatDate(file.date) },
    ];

    if (file.chunks) {
        infoItems.push({
            icon: Layers,
            label: "Chunks",
            value: `${file.chunks.length} part${file.chunks.length > 1 ? "s" : ""}`
        });
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-ctp-base rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-ctp-surface0/20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-ctp-surface0/20 bg-ctp-mantle/50">
                    <h3 className="font-bold text-ctp-text">File Information</h3>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost text-ctp-subtext0 hover:bg-ctp-red/10 hover:text-ctp-red"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {infoItems.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                            <div key={idx} className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-ctp-surface0/30 text-ctp-subtext0">
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-ctp-subtext0/60 uppercase tracking-wider mb-1">
                                        {item.label}
                                    </p>
                                    <p className="text-sm text-ctp-text break-all" title={item.value}>
                                        {item.value}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-ctp-surface0/20 bg-ctp-mantle/30">
                    <button
                        onClick={onClose}
                        className="w-full btn bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text border-0"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FileInfoModal;
