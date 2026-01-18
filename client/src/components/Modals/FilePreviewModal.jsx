import { Download, Music, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && !playerRef.current) {
      playerRef.current = new Plyr(videoRef.current, {
        autoplay: true,
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "captions",
          "settings",
          "pip",
          "airplay",
          "fullscreen",
        ],
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <video
        ref={videoRef}
        src={src}
        className="plyr-react plyr"
        playsInline
        controls
      />
    </div>
  );
};

// PDF Embed using blob URL to bypass download managers like IDM
const PDFEmbed = ({ src }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(src)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch PDF");
        return res.blob();
      })
      .then(blob => {
        if (isMounted) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="animate-spin w-10 h-10 border-4 border-ctp-blue border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-ctp-red p-4">
        <p>Failed to load PDF: {error}</p>
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl}
      className="w-full h-full bg-white"
      title="PDF Preview"
      style={{ border: 'none' }}
    />
  );
};

const FilePreviewModal = ({ file, api, token, onClose }) => {
  const [objectUrl, setObjectUrl] = useState(null);

  // Close on Escape & Cleanup
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  useEffect(() => {
    if (file) {
      const tokenParam = token ? `?token=${token}` : "";
      setObjectUrl(`${api}/download/${encodeURIComponent(file.name)}${tokenParam}`);
    }
  }, [file, api, token]);

  if (!file) return null;

  const getExt = (name) => name.split(".").pop().toLowerCase();
  const ext = getExt(file.name);
  const isVideo = ["mp4", "webm", "mkv", "mov"].includes(ext);
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isPdf = ["pdf"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg"].includes(ext);

  const renderContent = () => {
    if (!objectUrl) return null;

    if (isVideo) return <VideoPlayer src={objectUrl} />;
    if (isImage) return <img src={objectUrl} alt={file.name} className="max-w-full max-h-full object-contain" />;
    if (isAudio)
      return (
        <div className="w-full max-w-md p-8 bg-ctp-surface0/10 rounded-3xl backdrop-blur-xl border border-white/5 flex flex-col items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-ctp-blue/20 flex items-center justify-center animate-pulse">
            <Music size={40} className="text-ctp-blue" />
          </div>
          <audio src={objectUrl} controls className="w-full" />
        </div>
      );
    if (isPdf) return <PDFEmbed src={objectUrl} />;

    return (
      <div className="text-center">
        <p className="text-ctp-subtext0 mb-4">Preview not supported for this file type.</p>
        <a href={`${objectUrl}${objectUrl.includes("?") ? "&" : "?"}download=true`} className="btn btn-primary">
          Download File
        </a>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative w-full max-w-5xl h-[80vh] flex flex-col bg-ctp-base rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-ctp-surface0/20">
        {/* Header */}
        <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-ctp-surface0/20 bg-ctp-mantle/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="font-bold text-ctp-text truncate">{file.name}</div>
          </div>
          <div className="flex items-center gap-2">
            {objectUrl && (
              <a
                href={`${objectUrl}${objectUrl.includes("?") ? "&" : "?"}download=true`}
                download={file.name}
                className="btn btn-sm btn-ghost text-ctp-blue hover:bg-ctp-blue/10"
              >
                <Download size={18} />
              </a>
            )}
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost text-ctp-subtext0 hover:bg-ctp-red/10 hover:text-ctp-red"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-black/90 flex items-center justify-center relative overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
