import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Users, HardDrive, FileText, Search, Shield, ShieldAlert, Edit2, Save, X } from "lucide-react";

const AdminDashboard = () => {
    const { getAuthHeaders } = useAuth();
    const { addToast } = useToast();
    const [stats, setStats] = useState({ users: 0, files: 0, storage: 0 });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingUser, setEditingUser] = useState(null); // { id, limit }

    const API = import.meta.env.PROD ? "" : "http://localhost:3000";

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const headers = getAuthHeaders();

            const [statsRes, usersRes] = await Promise.all([
                fetch(`${API}/admin/stats`, { headers }),
                fetch(`${API}/admin/users`, { headers })
            ]);

            if (!statsRes.ok || !usersRes.ok) throw new Error("Failed to fetch admin data");

            const statsData = await statsRes.json();
            const usersData = await usersRes.json();

            setStats(statsData);
            setUsers(usersData);
        } catch (err) {
            console.error(err);
            addToast("Failed to load admin dashboard", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateLimit = async (userId, newLimit) => {
        try {
            const res = await fetch(`${API}/admin/users/${userId}/limit`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ limit: parseInt(newLimit) })
            });

            if (!res.ok) throw new Error("Failed to update limit");

            addToast("Storage limit updated", "success");
            setEditingUser(null);
            fetchData(); // Refresh data
        } catch (err) {
            addToast(err.message, "error");
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.id.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-ctp-blue">
                <div className="loading loading-spinner loading-lg"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ctp-text flex items-center gap-3">
                        <Shield className="text-ctp-red" />
                        Admin Dashboard
                    </h1>
                    <p className="text-ctp-subtext0 mt-1">System Overview & User Management</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    icon={<Users size={24} />}
                    label="Total Users"
                    value={stats.users}
                    color="bg-ctp-blue"
                />
                <StatsCard
                    icon={<FileText size={24} />}
                    label="Total Files"
                    value={stats.files}
                    color="bg-ctp-mauve"
                />
                <StatsCard
                    icon={<HardDrive size={24} />}
                    label="Total Storage Used"
                    value={formatSize(stats.storage)}
                    color="bg-ctp-green"
                />
            </div>

            {/* User Management */}
            <div className="bg-ctp-mantle/50 rounded-2xl border border-ctp-surface0/50 overflow-hidden">
                <div className="p-4 border-b border-ctp-surface0/50 flex items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-ctp-text">Users</h2>
                    <div className="relative max-w-xs w-full">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ctp-subtext0" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="input input-sm w-full pl-9 bg-ctp-surface0/30 border-ctp-surface0/50 text-ctp-text focus:outline-none focus:border-ctp-blue"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="text-ctp-subtext0 border-b border-ctp-surface0/30">
                                <th>User</th>
                                <th>Role</th>
                                <th>Joined</th>
                                <th>Storage Used</th>
                                <th>Limit</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="border-b border-ctp-surface0/10 hover:bg-ctp-surface0/5">
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="avatar">
                                                <div className="mask mask-squircle w-10 h-10">
                                                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`} alt="Avatar" />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-bold text-ctp-text">{user.username}</div>
                                                <div className="text-xs text-ctp-subtext0 opacity-50">{user.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {user.is_admin ? (
                                            <span className="badge badge-error gap-1 text-xs font-bold text-white">
                                                <ShieldAlert size={12} /> Admin
                                            </span>
                                        ) : (
                                            <span className="badge badge-ghost text-xs">User</span>
                                        )}
                                    </td>
                                    <td className="text-ctp-subtext0 text-sm">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="text-ctp-text font-mono text-sm">
                                        {formatSize(user.storage_used || 0)}
                                    </td>
                                    <td>
                                        {editingUser?.id === user.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    className="input input-xs w-24 bg-ctp-base border-ctp-surface0"
                                                    value={editingUser.limit}
                                                    onChange={(e) => setEditingUser({ ...editingUser, limit: e.target.value })}
                                                />
                                                <button
                                                    onClick={() => handleUpdateLimit(user.id, editingUser.limit)}
                                                    className="btn btn-xs btn-square btn-success text-white"
                                                >
                                                    <Save size={12} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingUser(null)}
                                                    className="btn btn-xs btn-square btn-ghost text-ctp-red"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group">
                                                <span className="text-ctp-subtext0 text-sm">{formatSize(user.storage_limit)}</span>
                                                <button
                                                    onClick={() => setEditingUser({ id: user.id, limit: user.storage_limit })}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-ctp-blue hover:text-ctp-blue/80"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {/* Future: Ban/Delete actions */}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const StatsCard = ({ icon, label, value, color }) => (
    <div className="bg-ctp-mantle/50 p-6 rounded-2xl border border-ctp-surface0/50 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg shadow-black/20`}>
            {icon}
        </div>
        <div>
            <p className="text-ctp-subtext0 text-sm font-medium">{label}</p>
            <p className="text-2xl font-black text-ctp-text mt-0.5">{value}</p>
        </div>
    </div>
);

export default AdminDashboard;
