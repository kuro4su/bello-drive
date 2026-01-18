import { Menu, Search, User } from "lucide-react";
import { useState, useEffect } from "react";

const Header = ({ setSidebarOpen, view, searchTerm, setSearchTerm, stats, api, user, onProfileClick }) => {
  // Sync Status Logic (Simplified for Cloud Mode)
  const [syncStatus, setSyncStatus] = useState("Online");
  // No polling needed for Supabase!

  return (
    <header className="h-16 border-b border-ctp-surface0/20 flex items-center justify-between px-6 shrink-0 bg-ctp-base/80 backdrop-blur-md shadow-sm z-10 transition-all duration-300">
      <div className="flex items-center gap-4 flex-1">
        <button
          className="md:hidden p-2 text-ctp-text hover:bg-ctp-surface0/20 rounded-full transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={24} />
        </button>
        <h2 className="text-lg font-bold text-ctp-text hidden md:block">
          {view === "dashboard" ? "Dashboard" : view === "files" ? "My Files" : "Recent Files"}
        </h2>

        {/* Search Bar */}
        <div className="relative max-w-md w-full ml-4 hidden sm:block">
          <label className="input input-sm input-bordered flex items-center gap-2 bg-ctp-surface0/50 border-transparent focus-within:border-ctp-blue/50 focus-within:bg-ctp-base text-ctp-text placeholder:text-ctp-subtext0 rounded-lg w-full transition-all">
            <Search size={16} className="text-ctp-subtext0" />
            <input
              type="text"
              className="grow p-0 placeholder:text-ctp-subtext0"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Profile / Stats */}
      <div className="flex items-center gap-4">
        {/* Sync Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-ctp-surface0/30 border border-ctp-surface0/10 hidden sm:flex">
          <div className={`w-2 h-2 rounded-full ${syncStatus === "Synced" || syncStatus === "Online" ? "bg-green-400 animate-pulse" : syncStatus === "Saving..." ? "bg-amber-400 animate-bounce" : "bg-red-400"}`}></div>
          <span className="text-xs font-bold text-ctp-subtext0 w-12 text-center">{syncStatus}</span>
        </div>

        <span className="hidden md:block text-xs font-bold text-ctp-subtext0/60 uppercase tracking-wider border-l border-ctp-surface0/20 pl-4">
          {stats.count} ITEMS
        </span>

        {/* User Profile */}
        <button
          onClick={onProfileClick}
          className="w-10 h-10 rounded-full bg-ctp-surface0 overflow-hidden border-2 border-ctp-surface0 hover:border-ctp-mauve transition-all shadow-sm"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ctp-subtext0 bg-ctp-surface0">
              <User size={20} />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
