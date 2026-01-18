import { useState } from "react";

const Breadcrumbs = ({ currentPath, setCurrentPath, createFolder, view, onFileDrop }) => {
  const [dragOverPath, setDragOverPath] = useState(null);

  const handleDragOver = (e, path) => {
    e.preventDefault();
    e.stopPropagation();
    // Only accept if we are not already in that path (basic check, refined in App.jsx)
    if (e.dataTransfer.types.includes("application/json")) {
      setDragOverPath(path);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
  };

  const handleDrop = (e, targetPath) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data && onFileDrop) {
        // If dropping on current path, do nothing (handled by App.jsx check too)
        if (targetPath === currentPath) return;

        onFileDrop(data, targetPath); // targetPath is absolute here
      }
    } catch (err) {
      // Invalid drop
    }
  };

  return (
    <div className="flex items-center gap-2 mb-6 text-sm text-ctp-subtext0">
      <button
        onClick={() => setCurrentPath("/")}
        onDragOver={(e) => handleDragOver(e, "/")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "/")}
        className={`hover:text-ctp-blue px-2 py-1 rounded-md transition-all ${currentPath === "/" ? "font-bold text-ctp-text" : ""
          } ${dragOverPath === "/" ? "bg-ctp-blue/20 text-ctp-blue ring-2 ring-ctp-blue/50" : ""}`}
      >
        Home
      </button>
      {currentPath !== "/" &&
        currentPath
          .split("/")
          .filter(Boolean)
          .map((part, i, arr) => {
            // Reconstruct path up to this part
            const pathUpToHere = "/" + arr.slice(0, i + 1).join("/") + "/";
            const isLast = i === arr.length - 1;

            return (
              <div key={pathUpToHere} className="flex items-center gap-2">
                <span>/</span>
                <button
                  onClick={() => setCurrentPath(pathUpToHere)}
                  onDragOver={(e) => !isLast && handleDragOver(e, pathUpToHere)}
                  onDragLeave={!isLast ? handleDragLeave : undefined}
                  onDrop={(e) => !isLast && handleDrop(e, pathUpToHere)}
                  className={`hover:text-ctp-blue px-2 py-1 rounded-md transition-all ${isLast ? "font-bold text-ctp-text pointer-events-none" : ""
                    } ${dragOverPath === pathUpToHere ? "bg-ctp-blue/20 text-ctp-blue ring-2 ring-ctp-blue/50" : ""}`}
                >
                  {part}
                </button>
              </div>
            );
          })}

      <div className="flex-1"></div>
      {view === "dashboard" && (
        <button onClick={createFolder} className="btn btn-xs btn-ghost text-ctp-blue hover:bg-ctp-blue/10">
          + New Folder
        </button>
      )}
    </div>
  );
};

export default Breadcrumbs;
