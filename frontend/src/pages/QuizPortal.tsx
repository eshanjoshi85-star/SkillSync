import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LockdownWrapper from '../components/LockdownWrapper';

// Strip trailing slash so we never double-slash when appending paths.
// VITE_API_URL should be set to something like https://skillsync.onrender.com/api
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

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

/** Steps:
 *  upload  → user picks a PDF and clicks "Extract Skills"
 *  skills  → user sees checkboxes, picks skills, clicks "Generate Quiz"
 *  ready   → summary screen; "Start Quiz" triggers fullscreen + transitions to quiz
 *  quiz    → active quiz in lockdown mode
 *  result  → score table
 *  blocked → violation block screen
 */
type Step = 'upload' | 'skills' | 'ready' | 'quiz' | 'result' | 'blocked';

const DIFFICULTY_COLORS: Record<string, string> = {
    MEDIUM: 'text-amber-400 bg-amber-400/10',
    HARD: 'text-rose-400 bg-rose-400/10',
};

export default function QuizPortal() {
    const { token } = useAuth();
    const navigate = useNavigate();

    // ── state ─────────────────────────────────────────────────────────────────
    const [step, setStep] = useState<Step>('upload');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [manualSkills, setManualSkills] = useState('');   // fallback when nothing extracted
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [current, setCurrent] = useState(0);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [violation, setViolation] = useState({ count: 0, blocked: false, unlocksAt: null as string | null });
    const [warningVisible, setWarningVisible] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── helpers ───────────────────────────────────────────────────────────────
    const handleViolation = useCallback((count: number, blocked: boolean, unlocksAt: string | null) => {
        setViolation({ count, blocked, unlocksAt });
        setWarningVisible(true);
        setTimeout(() => setWarningVisible(false), 4000);
        if (blocked && unlocksAt) setStep('blocked');
    }, []);

    const MAX_SKILLS = 3;

    const toggleSkill = (skill: string) => {
        setSelectedSkills(prev => {
            if (prev.includes(skill)) return prev.filter(s => s !== skill);
            if (prev.length >= MAX_SKILLS) return prev; // silently cap at 3
            return [...prev, skill];
        });
    };

    const selectAll = () => setSelectedSkills(extractedSkills.slice(0, MAX_SKILLS));
    const clearAll = () => setSelectedSkills([]);

    // Effective skills: from checkboxes OR from manual comma-input fallback
    const effectiveSkills = extractedSkills.length > 0
        ? selectedSkills
        : manualSkills.split(',').map(s => s.trim()).filter(Boolean);

    // ── Step 1: Extract Skills from PDF ──────────────────────────────────────
    const handleExtractSkills = async () => {
        if (!resumeFile) {
            setError('Please select a PDF resume first.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const form = new FormData();
            form.append('resume', resumeFile);
            const res = await fetch(`${API_BASE}/quiz/extract-skills`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to extract skills');

            const skills: string[] = data.skills || [];
            setExtractedSkills(skills);
            setSelectedSkills(skills); // default: all selected
            setStep('skills');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: Generate Quiz from selected skills ────────────────────────────
    const handleGenerate = async () => {
        const skills = effectiveSkills;
        if (skills.length === 0) {
            setError('Select at least one skill to generate a quiz.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/quiz/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ skills }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate quiz');

            setQuestions(data.questions);
            setAnswers({});
            setCurrent(0);
            setStep('ready');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Step 3: Start Quiz (fullscreen ONLY here) ─────────────────────────────
    const handleStartQuiz = () => {
        // requestFullscreen must be called directly inside a user-gesture handler
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(err => console.warn('Fullscreen request failed:', err));
        }
        setStep('quiz');
    };

    // ── Quiz: answer / submit ──────────────────────────────────────────────────
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
                body: JSON.stringify({ skills: effectiveSkills, questions, answers }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit quiz');
            setResult(data);
            setStep('result');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const answeredCount = Object.keys(answers).length;
    const pct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

    const resetAll = () => {
        setStep('upload');
        setResumeFile(null);
        setExtractedSkills([]);
        setSelectedSkills([]);
        setManualSkills('');
        setQuestions([]);
        setAnswers({});
        setResult(null);
        setError('');
    };

    return (
        <LockdownWrapper
            isActive={step === 'quiz'}
            onViolation={handleViolation}
            onBlocked={(u) => setViolation(v => ({ ...v, blocked: true, unlocksAt: u }))}
        >
            <div className="quiz-portal-root">
                {/* ── Violation Toast ── */}
                {warningVisible && !violation.blocked && (
                    <div className="violation-toast">
                        <span>⚠️ Tab switch detected! Violation {violation.count}/3</span>
                    </div>
                )}

                {/* ── Header ── */}
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
                        {/* Step indicator (upload / skills / ready) */}
                        {['upload', 'skills', 'ready'].includes(step) && (
                            <div className="quiz-step-indicator">
                                {['Upload', 'Skills', 'Ready'].map((label, i) => {
                                    const steps: Step[] = ['upload', 'skills', 'ready'];
                                    const active = steps.indexOf(step) >= i;
                                    return (
                                        <span key={label} className={`quiz-step-dot${active ? ' active' : ''}`}>
                                            {i + 1}. {label}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        <button className="quiz-exit-btn" onClick={() => navigate('/dashboard')}>✕ Exit</button>
                    </div>
                </header>

                <main className="quiz-main">

                    {/* ────────────────────────────────────────────────────── */}
                    {/* STEP 1: UPLOAD                                         */}
                    {/* ────────────────────────────────────────────────────── */}
                    {step === 'upload' && (
                        <div className="quiz-card quiz-upload-card">
                            <div className="quiz-card-icon">📄</div>
                            <h1 className="quiz-card-title">Skill Assessment Quiz</h1>
                            <p className="quiz-card-subtitle">
                                Upload your resume PDF to auto-detect your tech skills, then generate a personalised quiz powered by Gemini AI.
                            </p>

                            <div className="quiz-notice">
                                <span>🔒</span>
                                <p>This quiz runs in <strong>lockdown mode</strong>. Switching tabs or leaving fullscreen counts as a violation. 3 violations = 24-hour block.</p>
                            </div>

                            {/* Drop zone */}
                            <div
                                className="upload-zone"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    id="resume-input"
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        setResumeFile(e.target.files?.[0] ?? null);
                                        setError('');
                                    }}
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
                                        <div className="upload-hint">Click to upload your resume (PDF, max 5 MB)</div>
                                    </>
                                )}
                            </div>

                            {error && <div className="quiz-error">{error}</div>}

                            <button
                                className="quiz-btn-primary"
                                onClick={handleExtractSkills}
                                disabled={loading || !resumeFile}
                            >
                                {loading ? <span className="quiz-spinner">⏳ Scanning resume…</span> : '🔍 Extract Skills →'}
                            </button>
                        </div>
                    )}

                    {/* ────────────────────────────────────────────────────── */}
                    {/* STEP 2: SKILL SELECTION                                */}
                    {/* ────────────────────────────────────────────────────── */}
                    {step === 'skills' && (
                        <div className="quiz-card quiz-upload-card">
                            <div className="quiz-card-icon">🎯</div>
                            <h1 className="quiz-card-title">Select Skills for Your Quiz</h1>

                            {extractedSkills.length > 0 ? (
                                <>
                                    <p className="quiz-card-subtitle">
                                        ✅ {extractedSkills.length} skill{extractedSkills.length > 1 ? 's' : ''} detected in your resume.
                                        Pick up to <strong>3 skills</strong> to test ({selectedSkills.length}/{MAX_SKILLS} selected).
                                    </p>

                                    {/* Select All / Clear All */}
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        <button className="quiz-btn-ghost" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={selectAll}>
                                            ☑ Select All
                                        </button>
                                        <button className="quiz-btn-ghost" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={clearAll}>
                                            ☐ Clear All
                                        </button>
                                    </div>

                                    <div className="skill-picker-grid">
                                        {extractedSkills.map(skill => {
                                            const checked = selectedSkills.includes(skill);
                                            const atCap = selectedSkills.length >= MAX_SKILLS && !checked;
                                            return (
                                                <button
                                                    key={skill}
                                                    className={`skill-chip extracted${checked ? ' selected' : ''}${atCap ? ' disabled' : ''}`}
                                                    disabled={atCap}
                                                    onClick={() => toggleSkill(skill)}
                                                    aria-pressed={checked}
                                                >
                                                    <span style={{ marginRight: '4px' }}>{checked ? '☑' : '☐'}</span>
                                                    {skill}
                                                    <span className="skill-check" title="From resume">★</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {selectedSkills.length > 0 && (
                                        <div className="selected-skills-summary">
                                            {selectedSkills.length} skill{selectedSkills.length > 1 ? 's' : ''} selected
                                            → {selectedSkills.length * 5} questions will be generated
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* ── Fallback: no skills extracted ── */
                                <>
                                    <p className="quiz-card-subtitle" style={{ color: 'var(--quiz-muted)' }}>
                                        No skills were auto-detected. Enter them manually (comma-separated):
                                    </p>
                                    <input
                                        type="text"
                                        className="quiz-manual-input"
                                        placeholder="e.g. Java, React, SQL"
                                        value={manualSkills}
                                        onChange={e => setManualSkills(e.target.value)}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: '8px',
                                            border: '1px solid var(--quiz-border)', background: 'var(--quiz-input-bg)',
                                            color: 'inherit', fontSize: '14px', boxSizing: 'border-box',
                                            marginBottom: '12px',
                                        }}
                                    />
                                    {effectiveSkills.length > 0 && (
                                        <div className="selected-skills-summary">
                                            {effectiveSkills.length} skill{effectiveSkills.length > 1 ? 's' : ''} → {effectiveSkills.length * 5} questions
                                        </div>
                                    )}
                                </>
                            )}

                            {error && <div className="quiz-error">{error}</div>}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <button className="quiz-btn-ghost" onClick={() => setStep('upload')}>
                                    ← Back
                                </button>
                                <button
                                    className="quiz-btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={handleGenerate}
                                    disabled={loading || effectiveSkills.length === 0}
                                >
                                    {loading
                                        ? <span className="quiz-spinner">⏳ Generating quiz…</span>
                                        : `🚀 Generate Quiz (${effectiveSkills.length} skill${effectiveSkills.length !== 1 ? 's' : ''})`
                                    }
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ────────────────────────────────────────────────────── */}
                    {/* STEP 3: READY TO START                                 */}
                    {/* ────────────────────────────────────────────────────── */}
                    {step === 'ready' && (
                        <div className="quiz-card quiz-upload-card" style={{ textAlign: 'center' }}>
                            <div className="quiz-card-icon">🏁</div>
                            <h1 className="quiz-card-title">Quiz Ready!</h1>
                            <p className="quiz-card-subtitle">
                                {questions.length} question{questions.length !== 1 ? 's' : ''} across&nbsp;
                                <strong>{effectiveSkills.join(', ')}</strong>
                            </p>

                            <div className="quiz-notice" style={{ marginBottom: '24px' }}>
                                <span>⚠️</span>
                                <p>
                                    The quiz will open in <strong>fullscreen lockdown mode</strong>.
                                    Switching tabs or exiting fullscreen counts as a violation.
                                </p>
                            </div>

                            {/* Summary chips */}
                            <div className="skill-picker-grid" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                                {effectiveSkills.map(skill => (
                                    <span key={skill} className="skill-chip selected" style={{ cursor: 'default' }}>
                                        {skill}
                                    </span>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="quiz-btn-ghost" onClick={() => setStep('skills')}>
                                    ← Change Skills
                                </button>
                                {/* ONLY place we call requestFullscreen() */}
                                <button
                                    className="quiz-btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={handleStartQuiz}
                                >
                                    🎯 Start Quiz
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ────────────────────────────────────────────────────── */}
                    {/* STEP 4: QUIZ (lockdown active)                         */}
                    {/* ────────────────────────────────────────────────────── */}
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
                                    {loading ? '⏳ Submitting…' : `Submit Quiz (${answeredCount}/${questions.length})`}
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

                    {/* ────────────────────────────────────────────────────── */}
                    {/* STEP 5: RESULT                                          */}
                    {/* ────────────────────────────────────────────────────── */}
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
                                {Math.round((result.score / result.totalQuestions) * 100)}% correct ·{' '}
                                {result.passed ? 'Pass threshold: 60%' : 'Required: 60%'}
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
                                <button className="quiz-btn-primary" onClick={resetAll}>
                                    🔄 Take Another Quiz
                                </button>
                                <button className="quiz-btn-ghost" onClick={() => navigate('/dashboard')}>
                                    ← Back to Dashboard
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ────────────────────────────────────────────────────── */}
                    {/* STEP: BLOCKED                                           */}
                    {/* ────────────────────────────────────────────────────── */}
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
