import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Match {
    userId: string;
    name: string;
    bio: string | null;
    tokenBalance: number;
    matchingSkills: string[];
}

interface Skill {
    id: string;
    skill: { id: string; name: string };
}

export default function Matches() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [matches, setMatches] = useState<Match[]>([]);
    const [learnSkills, setLearnSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [scheduleFor, setScheduleFor] = useState<Match | null>(null);
    const [scheduleForm, setScheduleForm] = useState({ skillId: '', scheduledTime: '', durationMinutes: '15' });
    const [scheduling, setScheduling] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([
            api.get('/sessions/matches').then(r => setMatches(r.data)),
            api.get('/users/me/skills').then(r => setLearnSkills(r.data.filter((s: { type: string }) => s.type === 'LEARN'))),
        ]).finally(() => setLoading(false));
    }, []);

    const handleSchedule = async () => {
        if (!scheduleFor || !scheduleForm.skillId || !scheduleForm.scheduledTime) {
            setError('Please fill in all fields'); return;
        }
        setScheduling(true); setError('');
        try {
            await api.post('/sessions', {
                teacherId: scheduleFor.userId,
                skillId: scheduleForm.skillId,
                scheduledTime: scheduleForm.scheduledTime,
                durationMinutes: Number(scheduleForm.durationMinutes),
            });
            setScheduleFor(null);
            navigate('/dashboard');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            setError(msg || 'Failed to schedule session');
        } finally {
            setScheduling(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)' }}>
            <div style={{ position: 'fixed', top: 0, right: 0, width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <nav style={{ background: 'rgba(10,15,30,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)', padding: '0 2rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button id="back-dashboard" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>← Dashboard</button>
                    <span style={{ fontWeight: 700 }}>Find Matches</span>
                </div>
                <div className="token-badge animate-pulse-glow">⚡ {user?.tokenBalance ?? 0} tokens</div>
            </nav>

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Skill Matches</h1>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>Ranked by best mutual matches — people who can teach what you want to learn.</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                        <p>Finding your matches...</p>
                    </div>
                ) : matches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😕</div>
                        <h2 style={{ marginBottom: '0.5rem' }}>No matches found</h2>
                        <p style={{ color: 'var(--color-text-muted)' }}>Add skills you want to learn from your dashboard to find matches.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {matches.map((match, i) => (
                            <div key={match.userId} className="glass-card match-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                                {i === 0 && (
                                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '1rem', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>BEST MATCH</div>
                                )}
                                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: `linear-gradient(135deg, hsl(${match.userId.charCodeAt(0) * 5 % 360}, 70%, 40%), hsl(${match.userId.charCodeAt(1) * 7 % 360}, 70%, 40%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: 'white', marginBottom: '0.75rem' }}>
                                    {match.name.charAt(0).toUpperCase()}
                                </div>
                                <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{match.name}</h3>
                                {match.bio && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem', lineHeight: 1.5 }}>{match.bio}</p>}
                                <div style={{ marginTop: '0.875rem' }}>
                                    <p style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Can Teach You</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {match.matchingSkills.map(s => <span key={s} className="skill-tag teach" style={{ fontSize: '0.7rem' }}>⚡ {s}</span>)}
                                    </div>
                                </div>
                                <button id={`schedule-${match.userId}`} className="btn-primary" style={{ marginTop: '1rem', width: '100%', padding: '0.6rem', fontSize: '0.875rem' }} onClick={() => { setScheduleFor(match); setError(''); }}>
                                    📅 Schedule Session
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Schedule Modal */}
            {scheduleFor && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
                        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>Schedule with {scheduleFor.name}</h2>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Costs <strong style={{ color: '#818cf8' }}>5 tokens</strong>. You have {user?.tokenBalance} tokens.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Skill to Learn</label>
                                <select id="schedule-skill" className="input-field" value={scheduleForm.skillId} onChange={e => setScheduleForm({ ...scheduleForm, skillId: e.target.value })} style={{ appearance: 'none' }}>
                                    <option value="">Select skill...</option>
                                    {learnSkills.filter(s => scheduleFor.matchingSkills.includes(s.skill.name)).map(s => (
                                        <option key={s.id} value={s.skill.id}>{s.skill.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Date & Time</label>
                                <input id="schedule-time" className="input-field" type="datetime-local" value={scheduleForm.scheduledTime} onChange={e => setScheduleForm({ ...scheduleForm, scheduledTime: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Duration</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['15', '30'].map(d => (
                                        <button key={d} id={`duration-${d}`} onClick={() => setScheduleForm({ ...scheduleForm, durationMinutes: d })} style={{ flex: 1, padding: '0.6rem', borderRadius: '0.5rem', border: `1px solid ${scheduleForm.durationMinutes === d ? '#6366f1' : 'var(--color-border)'}`, background: scheduleForm.durationMinutes === d ? 'rgba(99,102,241,0.2)' : 'var(--color-surface-2)', color: scheduleForm.durationMinutes === d ? '#818cf8' : 'var(--color-text-muted)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                                            {d} min
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', padding: '0.6rem 0.875rem', color: '#fca5a5', fontSize: '0.8rem', marginTop: '1rem' }}>{error}</div>}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                            <button id="cancel-schedule" className="btn-secondary" style={{ flex: 1, padding: '0.75rem' }} onClick={() => setScheduleFor(null)}>Cancel</button>
                            <button id="confirm-schedule" className="btn-primary" style={{ flex: 2, padding: '0.75rem' }} onClick={handleSchedule} disabled={scheduling}>
                                {scheduling ? 'Scheduling...' : '📅 Confirm (5 tokens)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
