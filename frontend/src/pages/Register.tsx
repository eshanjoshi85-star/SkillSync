import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const POPULAR_SKILLS = ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Machine Learning', 'UI/UX Design', 'TypeScript', 'Go', 'Rust', 'DevOps', 'Data Analysis'];

export default function Register() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ email: '', password: '', name: '', bio: '' });
    const [teachSkills, setTeachSkills] = useState<string[]>([]);
    const [learnSkills, setLearnSkills] = useState<string[]>([]);
    const [customTeach, setCustomTeach] = useState('');
    const [customLearn, setCustomLearn] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleSkill = (skill: string, list: string[], setList: (v: string[]) => void) => {
        setList(list.includes(skill) ? list.filter(s => s !== skill) : [...list, skill]);
    };

    const addCustom = (val: string, list: string[], setList: (v: string[]) => void, setVal: (v: string) => void) => {
        const trimmed = val.trim();
        if (trimmed && !list.includes(trimmed)) setList([...list, trimmed]);
        setVal('');
    };

    const handleRegister = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await api.post('/auth/register', form);
            const { token } = data;
            localStorage.setItem('skillsync_token', token);

            // Add teach skills
            for (const skillName of teachSkills) {
                await api.post('/users/me/skills', { skillName, type: 'TEACH', category: 'Technology' });
            }
            // Add learn skills
            for (const skillName of learnSkills) {
                await api.post('/users/me/skills', { skillName, type: 'LEARN', category: 'Technology' });
            }

            login(data.user, token);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed');
            setStep(1);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)' }}>
            <div style={{ position: 'fixed', top: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-100px', left: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div className="glass-card w-full max-w-xl p-8">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="animate-float inline-block mb-3">
                        <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            <span style={{ fontSize: '24px' }}>⚡</span>
                        </div>
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #a5b4fc, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Join SkillSync</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                        {step === 1 ? 'Create your account' : step === 2 ? 'What can you teach?' : 'What do you want to learn?'}
                    </p>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
                    {[1, 2, 3].map(s => (
                        <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: s <= step ? 'linear-gradient(90deg, #6366f1, #06b6d4)' : 'var(--color-surface-2)', transition: 'background 0.3s ease' }} />
                    ))}
                </div>

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                {/* Step 1: Account info */}
                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                            <input id="reg-name" className="input-field" placeholder="Alice Johnson" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                            <input id="reg-email" className="input-field" type="email" placeholder="alice@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                            <input id="reg-password" className="input-field" type="password" placeholder="At least 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bio <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                            <textarea id="reg-bio" className="input-field" placeholder="Tell others about yourself..." value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2} style={{ resize: 'none' }} />
                        </div>
                        <button id="reg-next-1" className="btn-primary" style={{ padding: '0.875rem', fontSize: '1rem', marginTop: '0.5rem' }} onClick={() => { if (form.name && form.email && form.password) setStep(2); else setError('Please fill in all required fields'); }}>
                            Continue →
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                            <span style={{ padding: '0 10px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Or</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                        </div>

                        <a
                            href={`${import.meta.env.VITE_API_URL || '/api'}/auth/google`}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem', fontSize: '1rem', textDecoration: 'none', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Sign up with Google
                        </a>
                    </div>
                )}

                {/* Step 2: Teach skills */}
                {step === 2 && (
                    <div>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Select skills you can teach others (you'll earn tokens for each session)</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
                            {POPULAR_SKILLS.map(skill => (
                                <button key={skill} onClick={() => toggleSkill(skill, teachSkills, setTeachSkills)} style={{ padding: '0.35rem 0.85rem', borderRadius: '2rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease', background: teachSkills.includes(skill) ? 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(16,185,129,0.1))' : 'var(--color-surface-2)', border: teachSkills.includes(skill) ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--color-border)', color: teachSkills.includes(skill) ? '#10b981' : 'var(--color-text-muted)' }}>
                                    {teachSkills.includes(skill) ? '✓ ' : ''}{skill}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input className="input-field" placeholder="Add custom skill..." value={customTeach} onChange={e => setCustomTeach(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom(customTeach, teachSkills, setTeachSkills, setCustomTeach)} style={{ flex: 1 }} />
                            <button className="btn-secondary" onClick={() => addCustom(customTeach, teachSkills, setTeachSkills, setCustomTeach)}>Add</button>
                        </div>
                        {teachSkills.length > 0 && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {teachSkills.map(s => <span key={s} className="skill-tag teach">⚡ {s}</span>)}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                            <button className="btn-secondary" onClick={() => setStep(1)} style={{ flex: 1, padding: '0.875rem' }}>← Back</button>
                            <button id="reg-next-2" className="btn-primary" onClick={() => setStep(3)} style={{ flex: 2, padding: '0.875rem' }}>Continue →</button>
                        </div>
                    </div>
                )}

                {/* Step 3: Learn skills */}
                {step === 3 && (
                    <div>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Select skills you want to learn (you'll spend 5 tokens per session)</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
                            {POPULAR_SKILLS.map(skill => (
                                <button key={skill} onClick={() => toggleSkill(skill, learnSkills, setLearnSkills)} style={{ padding: '0.35rem 0.85rem', borderRadius: '2rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease', background: learnSkills.includes(skill) ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.1))' : 'var(--color-surface-2)', border: learnSkills.includes(skill) ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--color-border)', color: learnSkills.includes(skill) ? '#818cf8' : 'var(--color-text-muted)' }}>
                                    {learnSkills.includes(skill) ? '✓ ' : ''}{skill}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input className="input-field" placeholder="Add custom skill..." value={customLearn} onChange={e => setCustomLearn(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom(customLearn, learnSkills, setLearnSkills, setCustomLearn)} style={{ flex: 1 }} />
                            <button className="btn-secondary" onClick={() => addCustom(customLearn, learnSkills, setLearnSkills, setCustomLearn)}>Add</button>
                        </div>
                        {learnSkills.length > 0 && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {learnSkills.map(s => <span key={s} className="skill-tag learn">🎯 {s}</span>)}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                            <button className="btn-secondary" onClick={() => setStep(2)} style={{ flex: 1, padding: '0.875rem' }}>← Back</button>
                            <button id="reg-submit" className="btn-primary" onClick={handleRegister} disabled={loading} style={{ flex: 2, padding: '0.875rem', fontSize: '1rem' }}>
                                {loading ? 'Creating account...' : '🚀 Launch My Profile'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Already have an account? <Link to="/login" style={{ color: 'var(--color-primary-light)', fontWeight: 600, textDecoration: 'none' }}>Sign in →</Link>
                    </p>
                )}
            </div>
        </div>
    );
}
