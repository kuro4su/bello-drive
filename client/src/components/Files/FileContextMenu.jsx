import { Copy, Download, Edit3, FolderInput, Globe, Info, Link2, Lock, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const FileContextMenu = ({
    file,
    position,
    onClose,
    onRename,
    onMove,
    onCopy,
    onDownload,
    onDelete,
    onInfo,
    onShare,
    onToggleVisibility,
    // New Props
    isTrash,
    onRestore,
    onPermanentDelete
}) => {
    const menuRef = useRef(null);
    const [menuPosition, setMenuPosition] = useState(position);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    // Adjust position if menu would overflow viewport
    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const newPos = { ...position };

            if (rect.right > window.innerWidth) {
                newPos.x = window.innerWidth - rect.width - 10;
            }
            if (rect.bottom > window.innerHeight) {
                newPos.y = window.innerHeight - rect.height - 10;
            }

            setMenuPosition(newPos);
        }
    }, [position]);

    const menuItems = isTrash ? [
        { icon: Link2, label: "Restore", action: onRestore, color: "text-ctp-green" },
        { icon: Info, label: "File Info", action: onInfo, color: "text-ctp-teal" },
        { divider: true },
        { icon: Trash2, label: "Delete Forever", action: onPermanentDelete, color: "text-ctp-red" },
    ] : [
        { icon: Edit3, label: "Rename", action: onRename, color: "text-ctp-blue" },
        { icon: FolderInput, label: "Move to...", action: onMove, color: "text-ctp-yellow" },
        { icon: Copy, label: "Duplicate", action: onCopy, color: "text-ctp-green" },
        { icon: Link2, label: "Share Link", action: onShare, color: "text-ctp-mauve" },
        { icon: Info, label: "File Info", action: onInfo, color: "text-ctp-teal" },
        { divider: true },
        { icon: Download, label: "Download", action: onDownload, color: "text-ctp-sapphire" },
        { icon: Trash2, label: "Delete", action: onDelete, color: "text-ctp-red" },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed z-[200] min-w-[180px] bg-ctp-base border border-ctp-surface0/30 rounded-xl shadow-2xl py-2 animate-scale-in overflow-hidden"
            style={{ left: menuPosition.x, top: menuPosition.y }}
        >
            {/* File name header */}
            <div className="px-3 py-2 border-b border-ctp-surface0/20 mb-1">
                <p className="text-xs text-ctp-subtext0 truncate max-w-[200px]" title={file.name}>
                    {file.name}
                </p>
            </div>

            {menuItems.map((item, idx) => {
                if (item.divider) {
                    return <div key={idx} className="h-px bg-ctp-surface0/20 my-1" />;
                }

                const Icon = item.icon;
                return (
                    <button
                        key={idx}
                        onClick={() => {
                            item.action();
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ctp-text hover:bg-ctp-surface0/50 transition-colors"
                    >
                        <Icon size={16} className={item.color} />
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default FileContextMenu;
