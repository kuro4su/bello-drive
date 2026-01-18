import { useState, useEffect } from "react";
import { X, User, Shield, Zap, Save, Camera, Key, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const ProfileModal = ({ onClose, stats }) => {
    const { user, updateProfile, changePassword, uploadAvatar, logout } = useAuth();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState("stats"); // stats | settings
    const [loading, setLoading] = useState(false);

    // Profile State
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
    const [bio, setBio] = useState(user?.bio || "");

    // Password State
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Stats Calculation
    const storageUsed = parseInt(user?.storageUsed || stats?.size || 0);
    const storageLimit = parseInt(user?.storageLimit || 1073741824);
    const usagePercent = Math.min(100, (storageUsed / storageLimit) * 100);

    // Level Calculation (1 Level per 100MB used)
    const level = Math.floor(storageUsed / (100 * 1024 * 1024)) + 1;

    // Title based on level
    const getTitle = (lvl) => {
        if (lvl < 5) return "Novice Villager";
        if (lvl < 10) return "Apprentice Mage";
        if (lvl < 20) return "Dungeon Explorer";
        if (lvl < 50) return "High Wizard";
        if (lvl < 100) return "Demon Lord";
        return "Isekai Protagonist";
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateProfile({ bio });
            addToast("Profile updated!", "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        try {
            await uploadAvatar(file);
            setAvatarUrl(URL.createObjectURL(file)); // Optimistic update
            addToast("Avatar updated! Looking good!", "success");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return addToast("Passwords do not match!", "error");
        }
        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            addToast("Password changed successfully!", "success");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
            <div className="w-full max-w-2xl bg-ctp-base rounded-3xl shadow-2xl overflow-hidden animate-scale-in border-2 border-ctp-mauve/50 flex flex-col md:flex-row h-[600px] md:h-[500px]">

                {/* Sidebar / Character Visual */}
                <div className="w-full md:w-1/3 bg-gradient-to-br from-ctp-mauve/20 to-ctp-base p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-ctp-surface0/20 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-ctp-mauve to-transparent" />

                    <div className="relative w-32 h-32 rounded-full border-4 border-ctp-mauve shadow-xl mb-4 overflow-hidden bg-ctp-surface0">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-ctp-mauve">
                                <User size={48} />
                            </div>
                        )}
                    </div>

                    <h2 className="text-xl font-bold text-ctp-text text-center">{user?.username}</h2>
                    <div className="px-3 py-1 rounded-full bg-ctp-mauve/20 text-ctp-mauve text-xs font-bold mt-2 border border-ctp-mauve/30">
                        Lv. {level} {getTitle(level)}
                    </div>

                    <div className="mt-auto w-full pt-6">
                        <button
                            onClick={logout}
                            className="w-full btn btn-sm btn-ghost text-ctp-red hover:bg-ctp-red/10 flex items-center gap-2 justify-center"
                        >
                            <LogOut size={16} />
                            Log Out
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col bg-ctp-base">
                    {/* Header Tabs */}
                    <div className="flex border-b border-ctp-surface0/20">
                        <button
                            onClick={() => setActiveTab("stats")}
                            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === "stats"
                                ? "text-ctp-mauve border-b-2 border-ctp-mauve bg-ctp-mauve/5"
                                : "text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0/30"
                                }`}
                        >
                            <Shield size={16} />
                            Status
                        </button>
                        <button
                            onClick={() => setActiveTab("settings")}
                            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === "settings"
                                ? "text-ctp-mauve border-b-2 border-ctp-mauve bg-ctp-mauve/5"
                                : "text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0/30"
                                }`}
                        >
                            <Key size={16} />
                            Settings
                        </button>
                        <button
                            onClick={onClose}
                            className="w-14 flex items-center justify-center text-ctp-subtext0 hover:text-ctp-red hover:bg-ctp-red/10 transition-colors border-l border-ctp-surface0/20"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === "stats" ? (
                            <div className="space-y-6 animate-fade-in">
                                {/* Mana Bar (Storage) */}
                                <div className="bg-ctp-surface0/30 p-4 rounded-xl border border-ctp-surface0/50">
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="text-xs font-bold text-ctp-blue uppercase tracking-wider flex items-center gap-1">
                                            <Zap size={14} /> Mana (Storage)
                                        </label>
                                        <span className="text-xs text-ctp-text font-mono">
                                            {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
                                        </span>
                                    </div>
                                    <div className="h-4 bg-ctp-surface1 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-ctp-blue to-ctp-sapphire transition-all duration-1000 ease-out relative"
                                            style={{ width: `${usagePercent}%` }}
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-progress-stripes" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-ctp-subtext0 mt-2 text-right italic">
                                        {usagePercent.toFixed(1)}% mana consumed
                                    </p>
                                </div>

                                {/* Edit Profile Form */}
                                <form onSubmit={handleUpdateProfile} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-ctp-subtext0 uppercase tracking-wider mb-2">
                                            Avatar
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-ctp-surface0">
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-ctp-surface0 text-ctp-subtext0">
                                                        <User size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <label className="btn btn-sm bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text border-0 flex items-center gap-2 cursor-pointer">
                                                <Camera size={16} />
                                                Change Avatar
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleAvatarUpload}
                                                    disabled={loading}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-ctp-subtext0 uppercase tracking-wider mb-2">
                                            Bio / Status Message
                                        </label>
                                        <textarea
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                            className="w-full textarea bg-ctp-surface0/30 border-ctp-surface0/50 text-ctp-text focus:border-ctp-mauve focus:ring-1 focus:ring-ctp-mauve/30 resize-none h-24"
                                            placeholder="Write something cool..."
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn btn-sm bg-ctp-mauve hover:bg-ctp-mauve/80 text-ctp-base border-0 w-full flex items-center gap-2"
                                    >
                                        <Save size={16} />
                                        {loading ? "Saving..." : "Save Changes"}
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in">
                                <form onSubmit={handleChangePassword} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-ctp-subtext0 uppercase tracking-wider mb-2">
                                            Current Password
                                        </label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full input bg-ctp-surface0/30 border-ctp-surface0/50 text-ctp-text focus:border-ctp-mauve focus:ring-1 focus:ring-ctp-mauve/30"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-ctp-subtext0 uppercase tracking-wider mb-2">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full input bg-ctp-surface0/30 border-ctp-surface0/50 text-ctp-text focus:border-ctp-mauve focus:ring-1 focus:ring-ctp-mauve/30"
                                            required
                                            minLength={6}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-ctp-subtext0 uppercase tracking-wider mb-2">
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full input bg-ctp-surface0/30 border-ctp-surface0/50 text-ctp-text focus:border-ctp-mauve focus:ring-1 focus:ring-ctp-mauve/30"
                                            required
                                            minLength={6}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn btn-sm bg-ctp-red hover:bg-ctp-red/80 text-ctp-base border-0 w-full flex items-center gap-2"
                                    >
                                        <Key size={16} />
                                        {loading ? "Updating..." : "Change Password"}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
