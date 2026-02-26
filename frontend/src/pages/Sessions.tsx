import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

interface Session {
    id: string;
    status: string;
    scheduledTime: string;
    durationMinutes: number;
    tokensTransferred: number;
    meetingLink?: string;
    teacher: { id: string; name: string };
    learner: { id: string; name: string };
    skill: { name: string };
}

const statusColors: Record<string, string> = {
    PENDING: '#f59e0b',    // Yellow
    ACCEPTED: '#10b981',   // Green
    COMPLETED: '#3b82f6',  // Blue
    DECLINED: '#6b7280',   // Gray
    CANCELLED: '#ef4444',  // Red
};

export default function Sessions() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = () => {
        setLoading(true);
        api.get('/sessions')
            .then(r => setSessions(r.data))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const requestedSessions = sessions.filter(s => s.learner.id === user?.id);
    const incomingRequests = sessions.filter(s => s.teacher.id === user?.id);

    const handleStatusUpdate = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
        try {
            await api.patch(`/sessions/${id}/status`, { status });
            fetchSessions();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleComplete = async (id: string) => {
        try {
            await api.post(`/sessions/${id}/complete`);
            alert("Session completed successfully! Tokens transferred.");
            fetchSessions();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to complete session');
        }
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const StatusBadge = ({ status }: { status: string }) => {
        const color = statusColors[status] || '#6b7280';
        return (
            <span style={{
                fontSize: '0.75rem', fontWeight: 600, color: color,
                background: `${color}20`, padding: '4px 10px',
                borderRadius: '1rem', border: `1px solid ${color}40`
            }}>
                {status}
            </span>
        );
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)' }}>
            {/* Fixed decorative blobs */}
            <div style={{ position: 'fixed', top: 0, right: 0, width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Navbar */}
            <nav style={{ background: 'rgba(10,15,30,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)', padding: '0 2rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
                    <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', background: 'linear-gradient(135deg, #a5b4fc, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SkillSync</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="token-badge animate-pulse-glow">⚡ {user?.tokenBalance ?? 0} tokens</div>
                    <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>Dashboard</button>
                    <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={logout}>Sign Out</button>
                </div>
            </nav>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ marginBottom: '2.5rem' }}>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Sessions Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>Manage your learning and mentorship sessions.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Learner View: Requested Sessions */}
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '1.5rem' }}>🎓</div>
                            <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>My Requested Sessions</h2>
                        </div>
                        {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p> : requestedSessions.length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>No sessions requested yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {requestedSessions.sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime()).map(s => (
                                    <div key={s.id} style={{ background: 'var(--color-surface-2)', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid var(--color-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{s.skill.name}</p>
                                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                                    Mentor: <span style={{ color: '#a5b4fc' }}>{s.teacher.name}</span>
                                                </p>
                                            </div>
                                            <StatusBadge status={s.status} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                            <span>🕐 {formatDate(s.scheduledTime)}</span>
                                            <span>⏱ {s.durationMinutes}min</span>
                                        </div>
                                        {s.status === 'ACCEPTED' && s.meetingLink && (
                                            <div style={{ marginTop: '1rem', background: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                <p style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '0.25rem', fontWeight: 600 }}>Meeting Link</p>
                                                <a href={s.meetingLink} target="_blank" rel="noreferrer" style={{ color: '#67e8f9', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                                                    {s.meetingLink}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mentor View: Incoming Requests */}
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '1.5rem' }}>💡</div>
                            <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Incoming Mentorship Requests</h2>
                        </div>
                        {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p> : incomingRequests.length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>No incoming requests yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {incomingRequests.sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime()).map(s => (
                                    <div key={s.id} style={{ background: 'var(--color-surface-2)', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid var(--color-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{s.skill.name}</p>
                                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                                    Learner: <span style={{ color: '#67e8f9' }}>{s.learner.name}</span>
                                                </p>
                                            </div>
                                            <StatusBadge status={s.status} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                            <span>🕐 {formatDate(s.scheduledTime)}</span>
                                            <span>⏱ {s.durationMinutes}min</span>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                                            {s.status === 'PENDING' && (
                                                <>
                                                    <button className="btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', background: '#10b981', borderColor: '#10b981' }} onClick={() => handleStatusUpdate(s.id, 'ACCEPTED')}>
                                                        ✓ Accept
                                                    </button>
                                                    <button className="btn-secondary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }} onClick={() => handleStatusUpdate(s.id, 'DECLINED')}>
                                                        ✕ Decline
                                                    </button>
                                                </>
                                            )}
                                            {s.status === 'ACCEPTED' && (
                                                <button className="btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', background: '#3b82f6', borderColor: '#3b82f6' }} onClick={() => handleComplete(s.id)}>
                                                    ✅ Mark Completed
                                                </button>
                                            )}
                                            {s.status === 'ACCEPTED' && s.meetingLink && (
                                                <a href={s.meetingLink} target="_blank" rel="noreferrer" className="btn-secondary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', textAlign: 'center', textDecoration: 'none' }}>
                                                    🔗 Join Meet
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
