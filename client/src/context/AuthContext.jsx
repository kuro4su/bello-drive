import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

const API = import.meta.env.PROD ? "" : "http://localhost:3000";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);

    // Fetch current user on mount if token exists
    useEffect(() => {
        if (token) {
            fetchMe();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchMe = useCallback(async () => {
        try {
            const res = await fetch(`${API}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                // Token invalid, clear it
                logout();
            }
        } catch (err) {
            console.error("Auth check failed:", err);
            logout();
        } finally {
            setLoading(false);
        }
    }, [token]);

    const login = async (username, password) => {
        const res = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Login failed");
        }

        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const register = async (username, password) => {
        const res = await fetch(`${API}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Registration failed");
        }

        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    // Helper to get auth headers for API calls
    const getAuthHeaders = () => {
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
    };

    const updateProfile = async (data) => {
        const res = await fetch(`${API}/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify(data)
        });

        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Failed to update profile");

        setUser(resData.user);
        return resData.user;
    };

    const changePassword = async (currentPassword, newPassword) => {
        const res = await fetch(`${API}/auth/password`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to change password");
        return true;
    };

    const uploadAvatar = async (file) => {
        const formData = new FormData();
        formData.append("avatar", file);

        const res = await fetch(`${API}/auth/avatar`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to upload avatar");

        setUser(data.user);
        return data.user;
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            getAuthHeaders,
            updateProfile,
            changePassword,
            uploadAvatar,
            refreshUser: fetchMe
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
