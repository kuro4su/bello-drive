import { Check, Copy, Download, Link2, X, Globe, Lock } from "lucide-react";
import { useEffect, useState } from "react";

const ShareLinkModal = ({ shareData, onClose, api, getAuthHeaders, onVisibilityChange }) => {
    const [copied, setCopied] = useState(null);
    const [isPublic, setIsPublic] = useState(shareData?.isPublic || false);
    const [updating, setUpdating] = useState(false);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    useEffect(() => {
        if (shareData) {
            setIsPublic(shareData.isPublic || false);
        }
    }, [shareData]);

    if (!shareData) return null;

    const copyToClipboard = async (text, type) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return "";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const handleToggleVisibility = async () => {
        setUpdating(true);
        try {
            const res = await fetch(`${api}/files/${encodeURIComponent(shareData.filename)}/visibility`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ isPublic: !isPublic })
            });

            if (res.ok) {
                setIsPublic(!isPublic);
                if (onVisibilityChange) {
                    onVisibilityChange(shareData.filename, !isPublic);
                }
            } else {
                const data = await res.json();
                console.error("Failed to update visibility:", data.error);
            }
        } catch (err) {
            console.error("Failed to update visibility:", err);
        } finally {
            setUpdating(false);
        }
    };

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
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-ctp-mauve/20 text-ctp-mauve">
                            <Link2 size={18} />
                        </div>
                        <h3 className="font-bold text-ctp-text">Share Link</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost text-ctp-subtext0 hover:bg-ctp-red/10 hover:text-ctp-red"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* File Info */}
                <div className="px-5 py-4 border-b border-ctp-surface0/10 bg-ctp-mantle/20">
                    <p className="text-sm text-ctp-text font-medium truncate">{shareData.filename}</p>
                    {shareData.size && (
                        <p className="text-xs text-ctp-subtext0/60 mt-1">{formatSize(shareData.size)}</p>
                    )}
                </div>

                {/* Visibility Toggle */}
                <div className="px-5 py-4 border-b border-ctp-surface0/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {isPublic ? (
                                <div className="p-2 rounded-lg bg-ctp-green/20 text-ctp-green">
                                    <Globe size={18} />
                                </div>
                            ) : (
                                <div className="p-2 rounded-lg bg-ctp-red/20 text-ctp-red">
                                    <Lock size={18} />
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-medium text-ctp-text">
                                    {isPublic ? "Public" : "Private"}
                                </p>
                                <p className="text-xs text-ctp-subtext0/60">
                                    {isPublic ? "Anyone with the link can access" : "Only you can access"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleToggleVisibility}
                            disabled={updating}
                            className={`btn btn-sm ${isPublic ? "bg-ctp-green/20 text-ctp-green hover:bg-ctp-green/30" : "bg-ctp-surface0 text-ctp-text hover:bg-ctp-surface1"} border-0 transition-all`}
                        >
                            {updating ? "..." : isPublic ? "Make Private" : "Make Public"}
                        </button>
                    </div>
                </div>

                {/* Links - Only show if public */}
                {isPublic && (
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="text-xs text-ctp-subtext0/60 uppercase tracking-wider mb-2 block">
                                Direct Download Link
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={shareData.shareUrl}
                                    readOnly
                                    className="flex-1 input input-sm bg-ctp-surface0/30 border-ctp-surface0/50 text-ctp-text text-xs font-mono"
                                />
                                <button
                                    onClick={() => copyToClipboard(shareData.shareUrl, "share")}
                                    className={`btn btn-sm px-3 ${copied === "share"
                                        ? "bg-ctp-green text-ctp-base"
                                        : "bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text"
                                        } border-0 transition-all`}
                                >
                                    {copied === "share" ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Private message */}
                {!isPublic && (
                    <div className="p-5">
                        <div className="text-center text-ctp-subtext0/60 text-sm py-4">
                            <Lock size={24} className="mx-auto mb-2 opacity-50" />
                            <p>Make this file public to generate a shareable link</p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-4 border-t border-ctp-surface0/20 bg-ctp-mantle/30 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 btn bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text border-0"
                    >
                        Close
                    </button>
                    {isPublic && (
                        <a
                            href={shareData.downloadUrl}
                            download
                            className="flex-1 btn bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text border-0 flex items-center justify-center gap-2"
                        >
                            <Download size={16} />
                            Direct Download
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareLinkModal;
