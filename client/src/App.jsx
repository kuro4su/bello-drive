import { useState, useRef, useCallback } from "react";
import { UploadCloud } from "lucide-react";
import FileGrid from "./components/Files/FileGrid";
import Header from "./components/Layout/Header";
import Sidebar from "./components/Layout/Sidebar";
import FilePreviewModal from "./components/Modals/FilePreviewModal";
import SettingsModal from "./components/Modals/SettingsModal";
import Breadcrumbs from "./components/Navigation/Breadcrumbs";
import GlobalUploadProgress from "./components/Upload/GlobalUploadProgress";
import UploadModal from "./components/Modals/UploadModal";
import { processDropItems } from "./utils/fileScanner";
import { ToastProvider, useToast } from "./context/ToastContext";
import { useFileSystem } from "./hooks/useFileSystem";
import DragDropOverlay from "./components/UI/DragDropOverlay";
import { useUploadManager } from "./hooks/useUploadManager";

// File management components
import FileContextMenu from "./components/Files/FileContextMenu";
import BulkActionBar from "./components/Files/BulkActionBar";
import SortControls from "./components/Files/SortControls";
import FileInfoModal from "./components/Modals/FileInfoModal";
import MoveFileModal from "./components/Modals/MoveFileModal";
import ShareLinkModal from "./components/Modals/ShareLinkModal";
import RenameModal from "./components/Modals/RenameModal";
import ProfileModal from "./components/Profile/ProfileModal";
import AdminDashboard from "./components/Admin/AdminDashboard";

// Auth components
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./components/Auth/LoginPage";
import RegisterPage from "./components/Auth/RegisterPage";
import PublicBrowser from "./components/Public/PublicBrowser";

const API = import.meta.env.PROD ? "" : "http://localhost:3000";

const Dashboard = () => {
  const { user, logout, getAuthHeaders, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Modal states
  const [contextMenu, setContextMenu] = useState(null);
  const [fileInfoModal, setFileInfoModal] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [bulkMoveModal, setBulkMoveModal] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  // Memoize getAuthHeaders to prevent infinite loops
  const memoizedGetAuthHeaders = useCallback(() => getAuthHeaders(), [getAuthHeaders]);

  // Core Logic
  const {
    view,
    setView,
    stats,
    searchTerm,
    setSearchTerm,
    currentPath,
    setCurrentPath,
    refreshFiles,
    handleDelete,
    handleDeleteFolder,
    handleDownload,
    navigateToFolder,
    createFolder,
    displayFiles,
    displayFolders,
    activeOps,
    selectedFiles,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    handleRename,
    handleMove,
    handleMoveFolder,
    handleCopy,
    handleShare,
    handleBulkDelete,
    handleBulkMove,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    allFolders,
    handleRestore,
    handlePermanentDelete,
  } = useFileSystem(API, memoizedGetAuthHeaders);

  // Upload Logic
  const uploadState = useUploadManager(API, () => {
    refreshFiles();
    refreshUser();
  }, memoizedGetAuthHeaders);

  // Drag Drop Logic
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if it's a file drag (OS level) and NOT an internal drag
    const isFileDrag = e.dataTransfer.types &&
      Array.from(e.dataTransfer.types).includes("Files") &&
      !Array.from(e.dataTransfer.types).includes("application/json");

    if (isFileDrag) {
      dragCounter.current += 1;
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDragging) {
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedFiles = await processDropItems(e.dataTransfer);
    if (droppedFiles.length > 0) {
      uploadState.setFiles(droppedFiles);
      setUploadModalOpen(true);
    }
  };

  // Context Menu Handlers
  const handleContextMenu = (e, file) => {
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const closeContextMenu = () => setContextMenu(null);

  const onContextRename = () => setRenameModal(contextMenu.file);
  const onContextMove = () => setMoveModal(contextMenu.file);
  const onContextCopy = () => handleCopy(contextMenu.file.name);
  const onContextShare = async () => {
    const file = contextMenu.file;
    const data = await handleShare(file.name);
    if (data) setShareModal({ ...data, isPublic: file.isPublic });
  };
  const onContextInfo = () => setFileInfoModal(contextMenu.file);
  const onContextDownload = () => handleDownload(contextMenu.file);
  const onContextDelete = () => handleDelete(contextMenu.file.name);
  const onContextRestore = () => handleRestore(contextMenu.file.name);
  const onContextPermanentDelete = () => handlePermanentDelete(contextMenu.file.name);

  // Toggle visibility
  const onContextToggleVisibility = async () => {
    const file = contextMenu.file;
    const newVisibility = !file.isPublic;

    try {
      const res = await fetch(`${API}/files/${encodeURIComponent(file.name)}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ isPublic: newVisibility })
      });

      if (res.ok) {
        addToast(`File is now ${newVisibility ? "public" : "private"}`, "success");
        refreshFiles();
      } else {
        addToast("Failed to update visibility", "error");
      }
    } catch (err) {
      addToast("Failed to update visibility", "error");
    }
  }

  const onBulkMoveClick = () => setBulkMoveModal(true);

  const handleFileDrop = async (source, targetFolder) => {
    if (source.name === targetFolder) return; // Can't move folder into itself

    // Construct full target path
    let fullTargetPath = targetFolder;

    // If targetFolder is NOT absolute (doesn't start with /), construct it relative to currentPath
    if (!targetFolder.startsWith("/")) {
      fullTargetPath = currentPath === "/"
        ? `/${targetFolder}/`
        : `${currentPath}${targetFolder}/`;
    }

    if (source.type === "folder") {
      await handleMoveFolder(source.name, fullTargetPath);
    } else {
      await handleMove(source.name, fullTargetPath);
    }
  };

  return (
    <div
      className="flex h-screen bg-ctp-crust overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-ctp-mantle to-ctp-crust relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DragDropOverlay isDragging={isDragging} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} stats={stats} />}
      <FilePreviewModal
        file={previewFile}
        api={API}
        token={getAuthHeaders().Authorization?.replace("Bearer ", "")}
        onClose={() => setPreviewFile(null)}
      />
      <GlobalUploadProgress upload={uploadState} />

      {/* Modals */}
      {contextMenu && (
        <FileContextMenu
          file={contextMenu.file}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
          onRename={onContextRename}
          onMove={onContextMove}
          onCopy={onContextCopy}
          onShare={onContextShare}
          onInfo={onContextInfo}
          onDownload={onContextDownload}
          onDelete={onContextDelete}
          onToggleVisibility={onContextToggleVisibility}
          isTrash={view === "trash"}
          onRestore={onContextRestore}
          onPermanentDelete={onContextPermanentDelete}
        />
      )}

      {fileInfoModal && (
        <FileInfoModal file={fileInfoModal} onClose={() => setFileInfoModal(null)} />
      )}

      {moveModal && (
        <MoveFileModal
          file={moveModal}
          folders={allFolders}
          currentPath={currentPath}
          onMove={(folder) => {
            handleMove(moveModal.name, folder);
            setMoveModal(null);
          }}
          onClose={() => setMoveModal(null)}
        />
      )}

      {shareModal && (
        <ShareLinkModal
          shareData={shareModal}
          onClose={() => setShareModal(null)}
          api={API}
          getAuthHeaders={getAuthHeaders}
          onVisibilityChange={(filename, isPublic) => {
            // Refresh files to update UI
            refreshFiles();
          }}
        />
      )}

      {renameModal && (
        <RenameModal
          file={renameModal}
          onRename={(newName) => handleRename(renameModal.name, newName)}
          onClose={() => setRenameModal(null)}
        />
      )}

      {bulkMoveModal && (
        <MoveFileModal
          file={{ name: `${selectedFiles.size} files`, folder: currentPath }}
          folders={allFolders}
          currentPath={currentPath}
          onMove={(folder) => {
            handleBulkMove(folder);
            setBulkMoveModal(false);
          }}
          onClose={() => setBulkMoveModal(false)}
        />
      )}

      <BulkActionBar
        selectedCount={selectedFiles.size}
        onDelete={handleBulkDelete}
        onMove={onBulkMoveClick}
        onClear={clearSelection}
      />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-50 h-full transition-transform duration-300 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
      >
        <Sidebar
          stats={stats}
          view={view}
          setView={(v) => {
            setView(v);
            setCurrentPath("/");
            clearSelection();
          }}
          onSettingsClick={() => setSettingsOpen(true)}
          user={user}
          onLogout={logout}
        />
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          view={view}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          stats={stats}
          api={API}
          user={user}
          onProfileClick={() => setProfileOpen(true)}
        />

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Navigation & Sort Controls */}
            {!searchTerm && view !== "recent" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <Breadcrumbs
                  currentPath={currentPath}
                  setCurrentPath={(p) => {
                    setCurrentPath(p);
                    clearSelection();
                  }}
                  createFolder={createFolder}
                  view={view}
                  onFileDrop={handleFileDrop}
                />
                <SortControls
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                />
              </div>
            )}

            {/* Upload Modal */}
            <UploadModal
              open={uploadModalOpen}
              onClose={() => setUploadModalOpen(false)}
              uploadState={uploadState}
              currentPath={currentPath}
            />

            {/* Upload Button (Visible in Dashboard) */}
            {view === "dashboard" && !searchTerm && (
              <div className="mb-6 flex justify-end">
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="btn btn-primary gap-2 shadow-lg shadow-primary/20"
                >
                  <UploadCloud size={20} />
                  Upload Files
                </button>
              </div>
            )}

            {/* Admin Dashboard */}
            {view === "admin" && user?.isAdmin ? (
              <AdminDashboard />
            ) : (
              /* File Grid */
              <div className={view !== "dashboard" ? "mt-0" : ""}>
                <FileGrid
                  files={displayFiles}
                  folders={displayFolders}
                  api={API}
                  currentPath={currentPath}
                  setCurrentPath={setCurrentPath}
                  onDelete={handleDelete}
                  onFolderDelete={handleDeleteFolder}
                  onDownload={handleDownload}
                  activeOps={activeOps}
                  viewMode={viewMode}
                  onSelect={(file) => {
                    const ext = file.name.split(".").pop().toLowerCase();
                    if (["png", "jpg", "jpeg", "gif", "webp", "mp4", "webm", "mkv", "mov", "mp3", "wav", "ogg", "pdf"].includes(ext)) {
                      setPreviewFile(file);
                    }
                  }}
                  onFolderClick={navigateToFolder}
                  selectedFiles={selectedFiles}
                  onFileSelect={toggleFileSelection}
                  onContextMenu={handleContextMenu}
                  onFileDrop={handleFileDrop}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};


const AuthWrapper = () => {
  const { isAuthenticated, loading } = useAuth();
  const [authView, setAuthView] = useState("public"); // Start with public view

  if (loading) {
    return (
      <div className="min-h-screen bg-ctp-crust flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-ctp-blue border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === "public") {
      return <PublicBrowser onSwitchToLogin={() => setAuthView("login")} />;
    }
    if (authView === "login") {
      return (
        <LoginPage
          onSwitchToRegister={() => setAuthView("register")}
          onSwitchToPublic={() => setAuthView("public")}
        />
      );
    }
    return (
      <RegisterPage
        onSwitchToLogin={() => setAuthView("login")}
        onSwitchToPublic={() => setAuthView("public")}
      />
    );
  }

  return <Dashboard />;
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthWrapper />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;


