import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

interface MentorSkill {
    id: string; // Skill ID
    name: string;
    category: string;
    proficiencyLevel: string;
}

interface Mentor {
    id: string;
    name: string;
    bio: string | null;
    skills: MentorSkill[];
    isVerified: boolean;
    tokenCost: number;
}

const SEEDED_SKILLS = ["React", "TypeScript", "Node.js", "Python", "Java", "Docker", "UI/UX", "SQL"];

export default function Discovery() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [mentors, setMentors] = useState<Mentor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSkill, setSelectedSkill] = useState("");

    const [requestingId, setRequestingId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        fetchMentors();
    }, [selectedSkill]); // Re-fetch on filter change

    const fetchMentors = async () => {
        setLoading(true);
        setErrorMsg("");
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append("search", searchQuery);
            if (selectedSkill) params.append("skill", selectedSkill);

            const res = await api.get(`/mentors?${params.toString()}`);
            setMentors(res.data);
        } catch (err: any) {
            console.error("Failed to fetch mentors", err);
            setErrorMsg("Failed to load mentors. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchMentors();
    };

    const handleRequestSession = async (mentor: Mentor) => {
        if ((user?.tokenBalance ?? 0) < mentor.tokenCost) {
            setErrorMsg(`Not enough tokens! You need ${mentor.tokenCost} tokens to request a session with ${mentor.name}.`);
            setTimeout(() => setErrorMsg(""), 5000);
            return;
        }

        setRequestingId(mentor.id);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            // Schedule for tomorrow at top of hour
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setMinutes(0, 0, 0);

            await api.post('/sessions', {
                teacherId: mentor.id,
                skillId: mentor.skills[0]?.id, // Default to their first listed TEACH skill
                scheduledTime: tomorrow.toISOString(),
                durationMinutes: 30
            });

            setSuccessMsg(`Session requested with ${mentor.name}! Check your dashboard.`);
            setTimeout(() => setSuccessMsg(""), 4000);
        } catch (err: any) {
            console.error("Session request failed", err);
            setErrorMsg(err.response?.data?.error || "Failed to schedule session");
            setTimeout(() => setErrorMsg(""), 5000);
        } finally {
            setRequestingId(null);
        }
    };

    const toggleSkill = (skill: string) => {
        setSelectedSkill(prev => prev === skill ? "" : skill);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1040 100%)' }}>
            {/* Background elements */}
            <div style={{ position: 'fixed', top: 0, right: 0, width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Navbar */}
            <nav style={{ background: 'rgba(10,15,30,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)', padding: '0 2rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
                    <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', background: 'linear-gradient(135deg, #a5b4fc, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SkillSync</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="token-badge animate-pulse-glow">⚡ {user?.tokenBalance ?? 0} tokens</div>
                    <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>🏠 Dashboard</button>
                    <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={logout}>Sign Out</button>
                </div>
            </nav>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Find Your Mentor</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem' }}>Discover experts to learn from and level up your skills.</p>
                </div>

                {/* Alerts */}
                {errorMsg && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                        {errorMsg}
                    </div>
                )}
                {successMsg && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                        {successMsg}
                    </div>
                )}

                {/* Filter / Search Bar */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2.5rem' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>🔍</span>
                            <input
                                type="text"
                                className="input-field"
                                style={{ paddingLeft: '2.5rem' }}
                                placeholder="Search mentors by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Search</button>
                    </form>

                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>Filter by Skill Categories</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {SEEDED_SKILLS.map(skill => (
                                <button
                                    key={skill}
                                    onClick={() => toggleSkill(skill)}
                                    className={`skill-chip ${selectedSkill === skill ? 'selected' : ''}`}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s ease',
                                        transform: selectedSkill === skill ? 'scale(1.05)' : 'scale(1)',
                                        boxShadow: selectedSkill === skill ? '0 0 15px rgba(99,102,241,0.3)' : 'none'
                                    }}
                                >
                                    {selectedSkill === skill && <span className="skill-check">✓</span>}
                                    {skill}
                                </button>
                            ))}
                            {selectedSkill && (
                                <button
                                    onClick={() => setSelectedSkill("")}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer', marginLeft: '0.5rem', textDecoration: 'underline' }}
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mentor Grid */}
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                        {selectedSkill ? `${selectedSkill} Instructors` : 'All Instructors'}
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '1rem', marginLeft: '0.5rem', fontWeight: 500 }}>
                            ({loading ? '...' : mentors.length})
                        </span>
                    </h2>

                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="glass-card" style={{ padding: '1.5rem', minHeight: '220px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-surface-2)', animation: 'pulse 2s infinite' }}></div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ height: '20px', width: '120px', background: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 2s infinite' }}></div>
                                            <div style={{ height: '14px', width: '80px', background: 'var(--color-surface-2)', borderRadius: '4px', animation: 'pulse 2s infinite' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ height: '40px', width: '100%', background: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '1.5rem', animation: 'pulse 2s infinite' }}></div>
                                    <div style={{ marginTop: 'auto', height: '40px', width: '100%', background: 'var(--color-surface-2)', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
                                </div>
                            ))}
                        </div>
                    ) : mentors.length === 0 ? (
                        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.8 }}>🔭</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>No mentors found</h3>
                            <p style={{ color: 'var(--color-text-muted)' }}>Try adjusting your search criteria or selecting a different skill.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {mentors.map(mentor => (
                                <div key={mentor.id} className="glass-card match-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                                    {mentor.isVerified && (
                                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.1))', color: '#10b981', padding: '0.25rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid rgba(16,185,129,0.3)' }}>
                                            ✓ Verified User
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-surface-2), var(--color-border))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-light)' }}>
                                            {mentor.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>{mentor.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Cost per session:</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                    ⚡ {mentor.tokenCost}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {mentor.bio && (
                                        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            "{mentor.bio}"
                                        </p>
                                    )}

                                    <div style={{ marginBottom: '1.5rem', marginTop: 'auto' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teaches</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {mentor.skills.map(skill => (
                                                <span key={skill.id} className="skill-tag teach" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                                                    {skill.name} {skill.proficiencyLevel === 'ADVANCED' ? '⭐' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                        onClick={() => handleRequestSession(mentor)}
                                        disabled={requestingId === mentor.id}
                                    >
                                        {requestingId === mentor.id ? (
                                            <>
                                                <span style={{ animation: 'spin 1s linear infinite' }}>↻</span>
                                                Requesting...
                                            </>
                                        ) : (
                                            <>
                                                📅 Request Session
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
