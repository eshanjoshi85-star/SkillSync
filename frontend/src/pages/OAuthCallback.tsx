import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function OAuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [error, setError] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setError('Authentication failed: No token received.');
            setTimeout(() => navigate('/login'), 3000);
            return;
        }

        // Fetch user data
        const fetchUser = async () => {
            try {
                // Must set auth header for this request explicitly since api interceptor 
                // relies on localStorage which hasn't been set yet.
                const { data } = await api.get('/auth/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                login(data.user, token);
                navigate('/dashboard', { replace: true });
            } catch (err) {
                console.error("Failed to fetch user data after OAuth", err);
                setError('Failed to fetch user profile.');
                setTimeout(() => navigate('/login'), 3000);
            }
        };

        fetchUser();
    }, [searchParams, navigate, login]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="glass-card p-8 text-center text-red-500">
                    <p>{error}</p>
                    <p className="text-sm mt-2">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-card p-12 text-center">
                <div className="inline-block" style={{ animation: 'spin 1s linear infinite' }}>
                    <div style={{ width: '48px', height: '48px', border: '4px solid var(--color-surface-2)', borderTop: '4px solid var(--color-primary-light)', borderRadius: '50%' }} />
                </div>
                <h2 className="mt-6 text-xl font-bold">Completing authentication...</h2>
            </div>
        </div>
    );
}
