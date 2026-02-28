import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LockdownWrapper from '../components/LockdownWrapper';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    difficulty: 'MEDIUM' | 'HARD';
    skill: string;
}

interface QuizResult {
    score: number;
    totalQuestions: number;
    passed: boolean;
    tokensEarned: number;
    breakdown: Array<{
        id: string;
        correct: boolean;
        correctIndex: number;
        yourIndex: number;
    }>;
}

type Step = 'upload' | 'quiz' | 'result' | 'blocked';

const SKILL_OPTIONS = [
    'JavaScript', 'TypeScript', 'Python', 'React', 'Node.js',
    'SQL', 'Machine Learning', 'Data Structures', 'System Design', 'Kubernetes',
    'Docker', 'AWS', 'GraphQL', 'Rust', 'Go',
];

const DIFFICULTY_COLORS: Record<string, string> = {
    MEDIUM: 'text-amber-400 bg-amber-400/10',
    HARD: 'text-rose-400 bg-rose-400/10',
};

export default function QuizPortal() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>('upload');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [current, setCurrent] = useState(0);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [violation, setViolation] = useState({ count: 0, blocked: false, unlocksAt: null as string | null });
    const [warningVisible, setWarningVisible] = useState(false);

    const handleViolation = useCallback((count: number, blocked: boolean, unlocksAt: string | null) => {
        setViolation({ count, blocked, unlocksAt });
        setWarningVisible(true);
        setTimeout(() => setWarningVisible(false), 4000);
        if (blocked && unlocksAt) {
            setStep('blocked');
        }
    }, []);

    const toggleSkill = (skill: string) => {
        setSelectedSkills(prev => {
            if (prev.includes(skill)) return prev.filter(s => s !== skill);
            if (prev.length >= 2) return prev;
            return [...prev, skill];
        });
    };

    const handleGenerate = async () => {
        if (!resumeFile || selectedSkills.length === 0) {
            setError('Please upload your resume and select 1–2 skills.');
            return;
        }

        // Fullscreen on user gesture
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch((err) => console.error('Fullscreen error:', err));
        }

        setError('');
        setLoading(true);

        try {
            const form = new FormData();
            form.append('resume', resumeFile);
            form.append('skills', JSON.stringify(selectedSkills));

            const res = await fetch(`${API_BASE}/quiz/generate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate quiz');

            setQuestions(data.questions);
            setAnswers({});
            setCurrent(0);
            setStep('quiz');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (questionId: string, idx: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: idx }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/quiz/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ skills: selectedSkills, questions, answers }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit quiz');
            setResult(data);
            setStep('result');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const answeredCount = Object.keys(answers).length;
    const pct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

    return (
        <LockdownWrapper isActive={step === 'quiz'} onViolation={handleViolation} onBlocked={(u) => setViolation(v => ({ ...v, blocked: true, unlocksAt: u }))}>
            <div className="quiz-portal-root">
                {/* Violation Warning Toast */}
                {warningVisible && !violation.blocked && (
                    <div className="violation-toast">
                        <span>⚠️ Tab switch detected! Violation {violation.count}/3</span>
                    </div>
                )}

                {/* Header Bar */}
                <header className="quiz-header">
                    <div className="quiz-header-inner">
                        <div className="quiz-logo">
                            <span className="quiz-logo-icon">⚡</span>
                            <span className="quiz-logo-text">SkillSync <span>Quiz</span></span>
                        </div>
                        {step === 'quiz' && (
                            <div className="quiz-progress-bar-wrap">
                                <div className="quiz-progress-label">{answeredCount}/{questions.length} answered</div>
                                <div className="quiz-progress-track">
                                    <div className="quiz-progress-fill" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )}
                        <button className="quiz-exit-btn" onClick={() => navigate('/dashboard')}>✕ Exit</button>
                    </div>
                </header>

                <main className="quiz-main">
                    {/* ── STEP: UPLOAD ── */}
                    {step === 'upload' && (
                        <div className="quiz-card quiz-upload-card">
                            <div className="quiz-card-icon">📄</div>
                            <h1 className="quiz-card-title">Skill Assessment Quiz</h1>
                            <p className="quiz-card-subtitle">Upload your resume and pick 1–2 skills to generate a personalized quiz powered by Gemini AI.</p>

                            <div className="quiz-notice">
                                <span>🔒</span>
                                <p>This quiz runs in <strong>lockdown mode</strong>. Switching tabs or leaving fullscreen counts as a violation. 3 violations = 24-hour block.</p>
                            </div>

                            <div className="upload-zone" onClick={() => document.getElementById('resume-input')?.click()}>
                                <input
                                    id="resume-input"
                                    type="file"
                                    accept=".pdf"
                                    style={{ display: 'none' }}
                                    onChange={e => setResumeFile(e.target.files?.[0] ?? null)}
                                />
                                {resumeFile ? (
                                    <>
                                        <div className="upload-icon">✅</div>
                                        <div className="upload-filename">{resumeFile.name}</div>
                                        <div className="upload-hint">Click to change</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="upload-icon">📁</div>
                                        <div className="upload-hint">Click to upload your resume (PDF)</div>
                                    </>
                                )}
                            </div>

                            <div className="skill-picker-label">Select 1 or 2 skills to be tested on:</div>
                            <div className="skill-picker-grid">
                                {SKILL_OPTIONS.map(skill => (
                                    <button
                                        key={skill}
                                        className={`skill-chip ${selectedSkills.includes(skill) ? 'selected' : ''} ${selectedSkills.length >= 2 && !selectedSkills.includes(skill) ? 'disabled' : ''}`}
                                        onClick={() => toggleSkill(skill)}
                                    >
                                        {skill}
                                        {selectedSkills.includes(skill) && <span className="skill-check">✓</span>}
                                    </button>
                                ))}
                            </div>
                            {selectedSkills.length > 0 && (
                                <div className="selected-skills-summary">
                                    {selectedSkills.length === 1
                                        ? '5 questions will be generated (3 Medium + 2 Hard)'
                                        : '10 questions will be generated (4 Medium + 6 Hard)'}
                                </div>
                            )}

                            {error && <div className="quiz-error">{error}</div>}

                            <button
                                className="quiz-btn-primary"
                                onClick={handleGenerate}
                                disabled={loading || !resumeFile || selectedSkills.length === 0}
                            >
                                {loading ? (
                                    <span className="quiz-spinner">⏳ Generating quiz...</span>
                                ) : (
                                    '🚀 Generate & Start Quiz'
                                )}
                            </button>
                        </div>
                    )}

                    {/* ── STEP: QUIZ ── */}
                    {step === 'quiz' && questions.length > 0 && (
                        <div className="quiz-questions-layout">
                            {/* Question Navigator */}
                            <aside className="quiz-nav-panel">
                                <div className="quiz-nav-title">Questions</div>
                                <div className="quiz-nav-grid">
                                    {questions.map((q, i) => (
                                        <button
                                            key={q.id}
                                            className={`quiz-nav-dot ${current === i ? 'active' : ''} ${answers[q.id] !== undefined ? 'answered' : ''}`}
                                            onClick={() => setCurrent(i)}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <div className="quiz-nav-legend">
                                    <span className="legend-dot answered" /> Answered
                                    <span className="legend-dot active" /> Current
                                    <span className="legend-dot" /> Unanswered
                                </div>
                                <button
                                    className="quiz-btn-primary quiz-submit-btn"
                                    onClick={handleSubmit}
                                    disabled={loading || answeredCount === 0}
                                >
                                    {loading ? '⏳ Submitting...' : `Submit Quiz (${answeredCount}/${questions.length})`}
                                </button>
                                {error && <div className="quiz-error">{error}</div>}
                            </aside>

                            {/* Current Question */}
                            <div className="quiz-question-card">
                                <div className="quiz-question-meta">
                                    <span className={`difficulty-badge ${DIFFICULTY_COLORS[questions[current].difficulty]}`}>
                                        {questions[current].difficulty}
                                    </span>
                                    <span className="skill-badge">{questions[current].skill}</span>
                                    <span className="question-counter">Q{current + 1} of {questions.length}</span>
                                </div>
                                <h2 className="quiz-question-text">{questions[current].question}</h2>
                                <div className="quiz-options">
                                    {questions[current].options.map((opt, idx) => (
                                        <button
                                            key={idx}
                                            className={`quiz-option ${answers[questions[current].id] === idx ? 'selected' : ''}`}
                                            onClick={() => handleAnswer(questions[current].id, idx)}
                                        >
                                            <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                                            <span className="option-text">{opt}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="quiz-question-nav">
                                    <button
                                        className="quiz-btn-ghost"
                                        onClick={() => setCurrent(c => Math.max(0, c - 1))}
                                        disabled={current === 0}
                                    >
                                        ← Previous
                                    </button>
                                    <button
                                        className="quiz-btn-ghost"
                                        onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
                                        disabled={current === questions.length - 1}
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP: RESULT ── */}
                    {step === 'result' && result && (
                        <div className="quiz-card quiz-result-card">
                            <div className={`result-badge ${result.passed ? 'passed' : 'failed'}`}>
                                {result.passed ? '🏆 PASSED' : '❌ FAILED'}
                            </div>
                            <h1 className="quiz-card-title">Quiz Complete</h1>
                            <div className="result-score">
                                <span className="score-num">{result.score}</span>
                                <span className="score-denom">/ {result.totalQuestions}</span>
                            </div>
                            <div className="result-pct">
                                {Math.round((result.score / result.totalQuestions) * 100)}% correct · {result.passed ? 'Pass threshold: 60%' : 'Required: 60%'}
                            </div>
                            {result.passed && result.tokensEarned > 0 && (
                                <div className="tokens-earned-badge">
                                    <span className="tokens-earned-icon">🪙</span>
                                    <span className="tokens-earned-label">Tokens Earned:</span>
                                    <span className="tokens-earned-amount">+{result.tokensEarned}</span>
                                </div>
                            )}
                            <div className="result-breakdown">
                                {result.breakdown.map((b, i) => (
                                    <div key={b.id} className={`breakdown-row ${b.correct ? 'correct' : 'wrong'}`}>
                                        <span className="breakdown-q">Q{i + 1}</span>
                                        <span className="breakdown-icon">{b.correct ? '✓' : '✗'}</span>
                                        {!b.correct && (
                                            <span className="breakdown-hint">
                                                You: {String.fromCharCode(65 + b.yourIndex)} · Correct: {String.fromCharCode(65 + b.correctIndex)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="result-actions">
                                <button className="quiz-btn-primary" onClick={() => { setStep('upload'); setResult(null); setQuestions([]); setAnswers({}); setSelectedSkills([]); setResumeFile(null); }}>
                                    🔄 Take Another Quiz
                                </button>
                                <button className="quiz-btn-ghost" onClick={() => navigate('/dashboard')}>
                                    ← Back to Dashboard
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP: BLOCKED ── */}
                    {step === 'blocked' && (
                        <div className="quiz-card quiz-blocked-card">
                            <div className="blocked-icon">🔒</div>
                            <h1 className="quiz-card-title">Account Temporarily Blocked</h1>
                            <p className="quiz-card-subtitle">
                                You have been blocked for <strong>24 hours</strong> due to{' '}
                                <strong>3 tab-switch violations</strong> during your quiz session.
                            </p>
                            {violation.unlocksAt && (
                                <div className="blocked-unlocks">
                                    Unlocks at: <strong>{new Date(violation.unlocksAt).toLocaleString()}</strong>
                                </div>
                            )}
                            <button className="quiz-btn-ghost" onClick={() => navigate('/dashboard')}>
                                ← Return to Dashboard
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </LockdownWrapper>
    );
}
