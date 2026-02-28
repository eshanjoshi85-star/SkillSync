import { createRequire } from "module";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../lib/prisma";

// Use createRequire(import.meta.url) for ESM-safe CJS loading on Render.
// @ts-ignore – import.meta.url is valid at runtime on Render's Node ESM environment
const _cjsRequire = createRequire(import.meta.url);

type PdfParseFn = (buf: Buffer) => Promise<{ text?: string }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _pdfParseRaw: any = _cjsRequire("pdf-parse");

// Resolve pdf-parse callable across CJS/ESM/bundler export shapes:
// tries module itself, then .default, .pdfParse, .parse
const pdfParse: PdfParseFn | undefined =
    typeof _pdfParseRaw === "function"
        ? (_pdfParseRaw as PdfParseFn)
        : typeof _pdfParseRaw?.default === "function"
            ? (_pdfParseRaw.default as PdfParseFn)
            : typeof _pdfParseRaw?.pdfParse === "function"
                ? (_pdfParseRaw.pdfParse as PdfParseFn)
                : typeof _pdfParseRaw?.parse === "function"
                    ? (_pdfParseRaw.parse as PdfParseFn)
                    : undefined;

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

/** Extract plain text from a PDF buffer using pdf-parse */
export async function extractTextFromResume(dataBuffer: Buffer): Promise<string> {
    if (typeof pdfParse !== "function") {
        // Log the actual export shape so Render logs reveal the right key
        console.error("pdf-parse export shape:", {
            type: typeof _pdfParseRaw,
            keys: _pdfParseRaw ? Object.keys(_pdfParseRaw) : null,
            hasDefault: !!_pdfParseRaw?.default,
            defaultType: typeof _pdfParseRaw?.default,
        });
        throw new Error("pdf-parse failed to load on server runtime");
    }
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

        // Strip markdown code fences if present
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
 *  Hard-mode bonus: 2+ skills selected + passed ≥ 60% → awards +2 tokens via SYSTEM_BONUS.
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
    const passed = score / total >= 0.6; // 60% pass threshold
    const isHardMode = skills.length >= 2;
    const tokensEarned = passed && isHardMode ? 2 : 0;

    await prisma.$transaction(async (tx) => {
        // 1. Persist attempt record
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

        // 2. Award token bonus if hard-mode passed
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
