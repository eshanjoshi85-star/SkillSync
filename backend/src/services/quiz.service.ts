import { createRequire } from "module";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../lib/prisma.js";

const require = createRequire(import.meta.url);

type PdfParseFn = (buf: Buffer) => Promise<{ text?: string }>;

// ─── Lazy pdf-parse loader ────────────────────────────────────────────────────
// We never call require() at module scope so the server always starts, even if
// pdf-parse is missing or shaped differently on the target platform.

function resolvePdfParse(mod: any): PdfParseFn | null {
    if (typeof mod === "function") return mod;
    if (typeof mod?.default === "function") return mod.default;
    if (typeof mod?.pdfParse === "function") return mod.pdfParse;
    if (typeof mod?.parse === "function") return mod.parse;
    return null;
}

let cachedPdfParse: PdfParseFn | null | undefined = undefined;

function getPdfParse(): PdfParseFn {
    // Return cached result (null = permanently failed)
    if (cachedPdfParse !== undefined) {
        if (cachedPdfParse === null) throw new Error("pdf-parse not available");
        return cachedPdfParse;
    }

    try {
        const mod = require("pdf-parse");
        const fn = resolvePdfParse(mod);

        if (!fn) {
            console.error("pdf-parse loaded but export shape unexpected:", {
                type: typeof mod,
                keys: mod ? Object.keys(mod) : null,
                defaultType: typeof mod?.default,
            });
            cachedPdfParse = null;
            throw new Error("pdf-parse export shape unexpected");
        }

        cachedPdfParse = fn;
        return fn;
    } catch (e: any) {
        console.error("pdf-parse require() failed:", e?.message ?? e);
        cachedPdfParse = null;
        throw new Error(
            e?.code === "MODULE_NOT_FOUND"
                ? "pdf-parse is not installed in backend dependencies"
                : "pdf-parse failed to load"
        );
    }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    difficulty: "MEDIUM" | "HARD";
    skill: string;
}

export interface GeneratedQuiz {
    questions: QuizQuestion[];
    skills: string[];
}

/** Extract plain text from a PDF buffer using pdf-parse (lazy-loaded) */
export async function extractTextFromResume(dataBuffer: Buffer): Promise<string> {
    const pdfParse = getPdfParse(); // lazy load here, never at module scope
    try {
        const data = await pdfParse(dataBuffer);
        return (data?.text ?? "").trim();
    } catch (err) {
        console.error("pdf-parse error:", err);
        throw new Error("Failed to parse PDF. Please upload a valid, non-encrypted PDF file.");
    }
}

/**
 * Generate quiz questions for any non-empty set of skills.
 * Each skill gets 5 questions (3 Medium + 2 Hard).
 */
export async function generateQuizQuestions(
    skills: string[],
    resumeText?: string
): Promise<QuizQuestion[]> {
    if (!skills.length) {
        throw new Error("At least one skill must be selected.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const allQuestions: QuizQuestion[] = [];
    let questionCounter = 1;

    for (const skill of skills) {
        const prompt = `You are an expert technical assessor for the skill: "${skill}".

Generate 5 multiple-choice questions:
- 3 questions at MEDIUM difficulty
- 2 questions at HARD difficulty
${resumeText ? `\nResume context (use to personalise questions):\n"""\n${resumeText.slice(0, 2000)}\n"""\n` : ""}
Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "question": "...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "difficulty": "MEDIUM"
  }
]

Rules:
- Each question must have exactly 4 options
- correctIndex is 0-based
- Questions should test practical knowledge of "${skill}"
- Vary the correct answer positions
- Do not add any text outside the JSON array`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        const parsed: Array<{
            question: string;
            options: string[];
            correctIndex: number;
            difficulty: "MEDIUM" | "HARD";
        }> = JSON.parse(jsonStr);

        for (const q of parsed) {
            allQuestions.push({
                id: `q${questionCounter++}`,
                question: q.question,
                options: q.options,
                correctIndex: q.correctIndex,
                difficulty: q.difficulty,
                skill,
            });
        }
    }

    return allQuestions;
}

/** Score a submitted quiz and persist the attempt.
 *  Hard-mode bonus: 2+ skills selected + passed ≥ 60% → awards +2 tokens.
 */
export async function saveQuizAttempt(
    userId: string,
    skills: string[],
    questions: QuizQuestion[],
    answers: Record<string, number>
): Promise<{
    score: number;
    totalQuestions: number;
    passed: boolean;
    tokensEarned: number;
    breakdown: Array<{ id: string; correct: boolean; correctIndex: number; yourIndex: number }>;
}> {
    let score = 0;
    const breakdown = questions.map((q) => {
        const yours = answers[q.id] ?? -1;
        const correct = yours === q.correctIndex;
        if (correct) score++;
        return { id: q.id, correct, correctIndex: q.correctIndex, yourIndex: yours };
    });

    const total = questions.length;
    const passed = score / total >= 0.6;
    const isHardMode = skills.length >= 2;
    const tokensEarned = passed && isHardMode ? 2 : 0;

    await prisma.$transaction(async (tx) => {
        await tx.quizAttempt.create({
            data: {
                userId,
                skills,
                questions: questions as any,
                answers: answers as any,
                score,
                totalQuestions: total,
                passed,
            },
        });

        if (tokensEarned > 0) {
            await tx.user.update({
                where: { id: userId },
                data: { tokenBalance: { increment: tokensEarned } },
            });

            await tx.tokenHistory.create({
                data: {
                    userId,
                    amount: tokensEarned,
                    type: "SYSTEM_BONUS",
                },
            });
        }
    });

    return { score, totalQuestions: total, passed, tokensEarned, breakdown };
}
