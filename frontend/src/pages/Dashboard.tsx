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
    teacher: { id: string; name: string };
    learner: { id: string; name: string };
    skill: { name: string };
}

interface Skill {
    id: string;
    type: string;
    skill: { name: string };
}

const statusColors: Record<string, string> = {
    SCHEDULED: '#6366f1',
    IN_PROGRESS: '#f59e0b',
    COMPLETED: '#10b981',
    CANCELLED: '#ef4444',
};

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/sessions').then(r => setSessions(r.data)),
            api.get('/users/me/skills').then(r => setSkills(r.data)),
        ]).finally(() => setLoading(false));
    }, []);

    const teachSkills = skills.filter(s => s.type === 'TEACH');
    const learnSkills = skills.filter(s => s.type === 'LEARN');
    const upcomingSessions = sessions.filter(s => s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS');
    const completedSessions = sessions.filter(s => s.status === 'COMPLETED');

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)' }}>
            {/* Fixed decorative blobs */}
            <div style={{ position: 'fixed', top: 0, right: 0, width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Navbar */}
            <nav style={{ background: 'rgba(10,15,30,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)', padding: '0 2rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', background: 'linear-gradient(135deg, #a5b4fc, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SkillSync</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="token-badge animate-pulse-glow">⚡ {user?.tokenBalance ?? 0} tokens</div>
                    <button id="nav-quiz" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate('/quiz')}>🧠 Take Quiz</button>
                    <button id="nav-discovery" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate('/discovery')}>🔭 Find Mentors</button>
                    <button id="nav-sessions" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate('/sessions')}>📅 Sessions</button>
                    <button id="nav-matches" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate('/matches')}>🔍 Find Matches</button>
                    <button id="nav-logout" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={logout}>Sign Out</button>
                </div>
            </nav>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
                {/* Welcome */}
                <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>Keep teaching, keep learning, keep growing.</p>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {[
                        { icon: '⚡', label: 'Token Balance', value: user?.tokenBalance ?? 0, gradient: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.3)' },
                        { icon: '📅', label: 'Upcoming Sessions', value: upcomingSessions.length, gradient: 'rgba(6,182,212,0.2)', border: 'rgba(6,182,212,0.3)' },
                        { icon: '🎓', label: 'Sessions Completed', value: completedSessions.length, gradient: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.3)' },
                        { icon: '💡', label: 'Skills Listed', value: skills.length, gradient: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.3)' },
                    ].map(stat => (
                        <div key={stat.label} style={{ background: stat.gradient, border: `1px solid ${stat.border}`, borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>{stat.icon}</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)' }}>{loading ? '...' : stat.value}</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {/* Skills Panel */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>My Skills</h2>
                        </div>
                        {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p> : (
                            <>
                                {teachSkills.length > 0 && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>I Teach</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {teachSkills.map(s => <span key={s.id} className="skill-tag teach">⚡ {s.skill.name}</span>)}
                                        </div>
                                    </div>
                                )}
                                {learnSkills.length > 0 && (
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>I Want to Learn</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {learnSkills.map(s => <span key={s.id} className="skill-tag learn">🎯 {s.skill.name}</span>)}
                                        </div>
                                    </div>
                                )}
                                {skills.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No skills yet. Add some skills to find matches!</p>}
                                <button id="find-matches-btn" className="btn-primary" style={{ marginTop: '1.25rem', width: '100%', padding: '0.75rem' }} onClick={() => navigate('/matches')}>
                                    🔍 Find Learning Matches
                                </button>
                            </>
                        )}
                    </div>

                    {/* Upcoming Sessions */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>Upcoming Sessions</h2>
                        {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p> : upcomingSessions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📭</div>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No upcoming sessions. Find a match and schedule one!</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {upcomingSessions.slice(0, 4).map(s => {
                                    const isTeacher = s.teacher.id === user?.id;
                                    return (
                                        <div key={s.id} style={{ background: 'var(--color-surface-2)', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid var(--color-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.skill.name}</p>
                                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                                        {isTeacher ? `Teaching ${s.learner.name}` : `Learning from ${s.teacher.name}`}
                                                    </p>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: statusColors[s.status], background: `${statusColors[s.status]}20`, padding: '2px 8px', borderRadius: '1rem', border: `1px solid ${statusColors[s.status]}40` }}>
                                                    {s.status}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', color: 'var(--color-text-muted)', fontSize: '0.775rem' }}>
                                                <span>🕐 {formatDate(s.scheduledTime)}</span>
                                                <span>⏱ {s.durationMinutes}min</span>
                                            </div>
                                            {s.status === 'SCHEDULED' && (
                                                <button id={`start-session-${s.id}`} className="btn-primary" style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => navigate(`/session/${s.id}`)}>
                                                    ▶ Start Session
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent completed sessions */}
                {completedSessions.length > 0 && (
                    <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                        <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>Recent Sessions</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                            {completedSessions.slice(0, 6).map(s => {
                                const isTeacher = s.teacher.id === user?.id;
                                return (
                                    <div key={s.id} style={{ background: 'var(--color-surface-2)', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid rgba(16,185,129,0.2)' }}>
                                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.skill.name}</p>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                            {isTeacher ? `Taught ${s.learner.name}` : `Learned from ${s.teacher.name}`}
                                        </p>
                                        <p style={{ color: isTeacher ? '#10b981' : '#818cf8', fontSize: '0.8rem', marginTop: '0.4rem', fontWeight: 600 }}>
                                            {isTeacher ? `+${s.tokensTransferred}` : `-${s.tokensTransferred}`} tokens
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
