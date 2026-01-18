import { File, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { processDropItems } from "../../utils/fileScanner";

const UploadWidget = ({ uploadState, currentPath = "/", onStartQueue }) => {
  const { files, setFiles, uploading, progress, status, currentFileIndex, processQueue, cancelQueue, formatBytes } =
    uploadState;

  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const allFiles = await processDropItems(e.dataTransfer);
    if (allFiles.length > 0) {
      setFiles(allFiles);
    }
  };

  const handleFilesSelect = (e) => {
    if (e.target.files?.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full mb-6">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden
          ${dragActive
            ? "border-ctp-blue bg-ctp-blue/10"
            : "border-ctp-surface0/20 hover:border-ctp-surface0/40 hover:bg-ctp-surface0/5"
          }
          ${uploading ? "pointer-events-none opacity-100" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={(e) => {
          // Only trigger default file upload if clicking the container background
          // and NOT clicking buttons or inputs
          if (e.target === e.currentTarget && !uploading && files.length === 0) {
            document.querySelector('input[type="file"]:not([webkitdirectory])').click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFilesSelect}
          disabled={uploading}
        />
        <input
          ref={(el) => (inputRef.current = { ...inputRef.current, folder: el })}
          type="file"
          className="hidden"
          multiple
          webkitdirectory=""
          directory=""
          onChange={handleFilesSelect}
          disabled={uploading}
          id="folder-upload-input"
        />

        {files.length === 0 ? (
          <>
            <div className="p-4 bg-ctp-surface0/5 rounded-full text-ctp-blue mb-4 pointer-events-none">
              <UploadCloud size={32} />
            </div>
            <p className="text-ctp-text font-bold text-lg pointer-events-none">Drop files or folders here</p>
            <p className="text-ctp-subtext0 text-sm mt-1 mb-4 pointer-events-none">or click to upload files</p>

            <div className="flex gap-3 mt-2 z-10 relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  document.querySelector('input[type="file"]:not([webkitdirectory])').click();
                }}
                className="btn btn-sm bg-ctp-blue hover:bg-ctp-blue/80 text-ctp-base border-0"
              >
                <File size={16} /> Upload Files
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('folder-upload-input').click();
                }}
                className="btn btn-sm bg-ctp-mauve hover:bg-ctp-mauve/80 text-ctp-base border-0"
              >
                <UploadCloud size={16} /> Upload Folder
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center w-full max-w-sm">
            {!uploading ? (
              <>
                <div className="relative mb-4">
                  <div className="absolute top-0 right-0 -mr-2 -mt-2 bg-ctp-blue text-ctp-base text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">
                    {files.length}
                  </div>
                  {files.length > 1 ? (
                    <div className="stack">
                      <div className="p-4 bg-ctp-surface0/20 rounded-xl border border-ctp-surface0/10 text-ctp-blue opacity-60 scale-90 translate-y-2">
                        <File size={40} />
                      </div>
                      <div className="p-4 bg-ctp-surface0/10 rounded-xl border border-ctp-surface0/10 text-ctp-blue">
                        <File size={40} />
                      </div>
                    </div>
                  ) : (
                    <File size={48} className="text-ctp-blue animate-bounce" />
                  )}
                </div>

                <div className="text-center w-full mb-6">
                  <p className="font-bold text-ctp-text truncate max-w-[200px] mx-auto text-lg">
                    {files.length === 1 ? files[0].name : `${files.length} Files Selected`}
                  </p>
                  <p className="text-sm text-ctp-subtext0 mt-1">
                    Total: {formatBytes(files.reduce((acc, f) => acc + f.size, 0))}
                  </p>
                  {files.length > 1 && (
                    <p className="text-xs text-ctp-subtext0/60 mt-2 italic">
                      {files
                        .slice(0, 3)
                        .map((f) => f.name)
                        .join(", ")}{" "}
                      {files.length > 3 ? "..." : ""}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 w-full">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles([]);
                    }}
                    className="btn btn-ghost bg-ctp-surface0/20 hover:bg-ctp-red/10 hover:text-ctp-red text-ctp-subtext0"
                  >
                    Clear
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      processQueue(currentPath);
                      onStartQueue?.();
                    }}
                    className="btn btn-primary flex-1 shadow-lg shadow-primary/20 bg-ctp-blue hover:bg-ctp-sapphire border-none text-ctp-base"
                  >
                    Start Queue
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full animate-fade-in-up pointer-events-auto">
                {/* Header Info */}
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="badge badge-xs badge-primary badge-outline font-mono shrink-0">
                      {currentFileIndex + 1}/{files.length}
                    </span>
                    <span className="text-sm font-medium text-ctp-text truncate" title={files[currentFileIndex]?.name}>
                      {files[currentFileIndex]?.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-ctp-blue font-mono">{progress}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-ctp-surface0 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-ctp-blue transition-all duration-300 ease-out shadow-[0_0_8px_rgba(137,180,250,0.6)]"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-ctp-subtext0/50 uppercase tracking-widest">{status}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelQueue();
                    }}
                    className="btn btn-xs btn-error btn-outline gap-1"
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadWidget;
