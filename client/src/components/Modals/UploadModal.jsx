import { X } from "lucide-react";
import UploadWidget from "../Upload/UploadWidget";

const UploadModal = ({ open, onClose, uploadState, currentPath }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
            <div className="relative w-full max-w-2xl bg-ctp-base rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-ctp-surface0/20">
                {/* Header */}
                <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-ctp-surface0/20 bg-ctp-mantle/50">
                    <h2 className="font-bold text-ctp-text text-lg">Upload Files</h2>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost text-ctp-subtext0 hover:bg-ctp-red/10 hover:text-ctp-red"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <UploadWidget
                        uploadState={uploadState}
                        currentPath={currentPath}
                        onStartQueue={onClose} // Optional: close modal when queue starts
                    />
                </div>
            </div>
        </div>
    );
};

export default UploadModal;
