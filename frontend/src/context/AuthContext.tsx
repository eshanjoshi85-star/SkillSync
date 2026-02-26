import { createContext, useContext, useState, type ReactNode } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
    tokenBalance: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (user: User, token: string) => void;
    logout: () => void;
    updateBalance: (balance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('skillsync_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('skillsync_token')
    );

    const login = (user: User, token: string) => {
        setUser(user);
        setToken(token);
        localStorage.setItem('skillsync_user', JSON.stringify(user));
        localStorage.setItem('skillsync_token', token);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('skillsync_user');
        localStorage.removeItem('skillsync_token');
    };

    const updateBalance = (balance: number) => {
        if (user) {
            const updated = { ...user, tokenBalance: balance };
            setUser(updated);
            localStorage.setItem('skillsync_user', JSON.stringify(updated));
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, updateBalance }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
