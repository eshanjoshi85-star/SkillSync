import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

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

function useCountdown(totalSeconds: number, running: boolean) {
    const [timeLeft, setTimeLeft] = useState(totalSeconds);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        setTimeLeft(totalSeconds);
    }, [totalSeconds]);

    useEffect(() => {
        if (running && timeLeft > 0) {
            intervalRef.current = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [running, timeLeft]);

    const pct = totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 0;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return { timeLeft, pct, display: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` };
}

export default function SessionView() {
    const { id } = useParams<{ id: string }>();
    const { user, updateBalance } = useAuth();
    const navigate = useNavigate();
    const [session, setSession] = useState<Session | null>(null);
    const [running, setRunning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (id) api.get('/sessions').then(r => {
            const s = r.data.find((s: Session) => s.id === id);
            setSession(s || null);
        }).finally(() => setLoading(false));
    }, [id]);

    const totalSecs = (session?.durationMinutes ?? 15) * 60;
    const { timeLeft, pct, display } = useCountdown(totalSecs, running);

    const circumference = 2 * Math.PI * 90;
    const strokeDash = (pct / 100) * circumference;

    const completeSession = useCallback(async () => {
        if (!session || completing) return;
        setRunning(false);
        setCompleting(true);
        try {
            const { data } = await api.patch(`/sessions/${session.id}/complete`);
            setSession(data.session);
            const meRes = await api.get('/users/me');
            updateBalance(meRes.data.tokenBalance);
            setDone(true);
        } catch {
            setCompleting(false);
        }
    }, [session, completing, updateBalance]);

    // Auto-complete when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && running && session?.status === 'SCHEDULED') {
            completeSession();
        }
    }, [timeLeft, running, session, completeSession]);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>Loading session...</p>
        </div>
    );

    if (!session) return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '3rem' }}>❌</p>
                <p style={{ color: 'var(--color-text-muted)', marginTop: '1rem' }}>Session not found</p>
                <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );

    const isTeacher = session.teacher.id === user?.id;
    const partner = isTeacher ? session.learner : session.teacher;
    const isCompleted = session.status === 'COMPLETED' || done;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ position: 'fixed', top: 0, right: 0, width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem', textAlign: 'center' }}>
                {/* Skill & partner */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <span className="skill-tag learn" style={{ fontSize: '0.875rem', marginBottom: '0.75rem', display: 'inline-block' }}>📚 {session.skill.name}</span>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.5rem' }}>
                        {isTeacher ? `Teaching ${partner.name}` : `Learning from ${partner.name}`}
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.3rem' }}>
                        {session.durationMinutes}-minute micro-session
                    </p>
                </div>

                {/* Countdown timer ring */}
                {!isCompleted ? (
                    <>
                        <div className="timer-ring" style={{ marginBottom: '2rem' }}>
                            <svg width="220" height="220" viewBox="0 0 220 220">
                                {/* Background track */}
                                <circle cx="110" cy="110" r="90" fill="none" stroke="var(--color-surface-2)" strokeWidth="12" />
                                {/* Progress arc */}
                                <circle
                                    cx="110" cy="110" r="90"
                                    fill="none"
                                    stroke="url(#timerGradient)"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                    strokeDasharray={`${strokeDash} ${circumference}`}
                                    transform="rotate(-90 110 110)"
                                    style={{ transition: 'stroke-dasharray 1s linear' }}
                                />
                                <defs>
                                    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#06b6d4" />
                                    </linearGradient>
                                </defs>
                                {/* Time text */}
                                <text x="110" y="100" textAnchor="middle" fill="var(--color-text)" fontSize="40" fontWeight="800" fontFamily="Inter, sans-serif">{display}</text>
                                <text x="110" y="130" textAnchor="middle" fill="var(--color-text-muted)" fontSize="13" fontFamily="Inter, sans-serif">
                                    {running ? 'session in progress' : timeLeft === 0 ? 'time up!' : 'ready to start'}
                                </text>
                            </svg>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {!running ? (
                                <button id="start-timer" className="btn-primary" style={{ padding: '1rem', fontSize: '1rem' }} onClick={() => setRunning(true)}>
                                    ▶ Start Timer
                                </button>
                            ) : (
                                <button id="pause-timer" className="btn-secondary" style={{ padding: '1rem', fontSize: '1rem' }} onClick={() => setRunning(false)}>
                                    ⏸ Pause
                                </button>
                            )}
                            <button id="complete-session" className="btn-primary" style={{ padding: '1rem', fontSize: '1rem', background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={completeSession} disabled={completing}>
                                {completing ? 'Completing...' : '✅ Mark Complete & Transfer Tokens'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '1rem 0' }}>
                        <div className="animate-float" style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Session Complete!</h2>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                            {isTeacher
                                ? `You earned +${session.tokensTransferred || 5} tokens for teaching ${partner.name}!`
                                : `You've spent ${session.tokensTransferred || 5} tokens. Great learning session!`}
                        </p>
                        <div style={{ background: isTeacher ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${isTeacher ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`, borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: isTeacher ? '#10b981' : '#818cf8' }}>
                                {isTeacher ? '+' : '-'}{session.tokensTransferred || 5} tokens
                            </span>
                        </div>
                        <button id="back-to-dashboard" className="btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={() => navigate('/dashboard')}>
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
