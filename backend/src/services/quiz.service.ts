import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../lib/prisma.js";

// ─── pdf-parse v2 lazy loader ─────────────────────────────────────────────────
// pdf-parse v2.x exports a CLASS (PDFParse), not a callable function.
// v1 API: await pdf(buffer)          ← does NOT exist in v2
// v2 API: new PDFParse({data}).getText() → { text: string }
//
// Using dynamic import() for full ESM compatibility (works for CJS and ESM packages).
// Nothing runs at module scope → server always starts even if pdf-parse is missing.

type PDFParseClass = {
    new(options: { data: Uint8Array }): { getText(): Promise<{ text: string }> };
};

let cachedPDFParse: PDFParseClass | undefined = undefined;

async function getPDFParse(): Promise<PDFParseClass> {
    if (cachedPDFParse) return cachedPDFParse;

    try {
        const mod = await import("pdf-parse") as any;

        // pdf-parse v2 exports: { PDFParse: class }
        const Cls: PDFParseClass =
            typeof mod?.PDFParse === "function" ? mod.PDFParse :
                typeof mod?.default?.PDFParse === "function" ? mod.default.PDFParse :
                    typeof mod?.default === "function" ? mod.default :
                        typeof mod === "function" ? mod : null;

        if (!Cls) {
            console.error("pdf-parse: could not resolve class/function from module:", {
                keys: Object.keys(mod ?? {}),
                defaultKeys: mod?.default ? Object.keys(mod.default) : null,
            });
            throw new Error("pdf-parse export shape not recognised");
        }

        cachedPDFParse = Cls;
        return Cls;
    } catch (e: any) {
        const isNotFound = e?.code === "ERR_MODULE_NOT_FOUND" || e?.code === "MODULE_NOT_FOUND";
        console.error("pdf-parse import failed:", e?.code ?? e?.message);
        throw new Error(isNotFound
            ? "pdf-parse is not installed in backend dependencies"
            : (e?.message ?? "pdf-parse failed to load"));
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

/** Extract plain text from a PDF buffer using pdf-parse v2 class API */
export async function extractTextFromResume(dataBuffer: Buffer): Promise<string> {
    const PDFParse = await getPDFParse();
    try {
        const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });
        const result = await parser.getText();
        return (result?.text ?? "").trim();
    } catch (err) {
        console.error("pdf-parse getText() error:", err);
        throw new Error("Failed to parse PDF. Please upload a valid, non-encrypted PDF file.");
    }
}




function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function extractRetryDelayMs(err: any): number | null {
    const details = err?.errorDetails ?? err?.details ?? err?.response?.data?.error?.details;
    const asText = JSON.stringify(details ?? {});
    const m = asText.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (m) return Number(m[1]) * 1000;
    return null;
}

async function geminiGenerateWithRetry(
    modelNames: string[],
    prompt: string,
    maxRetries = 2
) {
    for (let m = 0; m < modelNames.length; m++) {
        const modelName = modelNames[m];
        const model = genAI.getGenerativeModel({ model: modelName });
        let attempt = 0;
        while (true) {
            try {
                console.log(`Gemini: using model=${modelName}`);
                return await model.generateContent(prompt);
            } catch (err: any) {
                const status = err?.status ?? err?.response?.status;
                if (status === 429 && attempt < maxRetries) {
                    const retryMs = extractRetryDelayMs(err) ?? (2 ** attempt) * 2000;
                    console.warn(`Gemini 429 on ${modelName}. Retrying in ${Math.ceil(retryMs / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`);
                    await sleep(retryMs);
                    attempt++;
                    continue;
                }
                // On 429 exhausted, try next model in list
                if (status === 429 && m < modelNames.length - 1) {
                    console.warn(`Gemini 429 exhausted retries on ${modelName}. Falling back to ${modelNames[m + 1]}...`);
                    break; // break inner while → next model
                }
                throw err;
            }
        }
    }
    // Should never reach here — last model always throws
    throw new Error("All Gemini models exhausted");
}

/**
 * Generate quiz questions for all selected skills in ONE Gemini call.
 * 5 questions per skill (3 Medium + 2 Hard). Max 3 skills by default (free tier safe).
 */
export async function generateQuizQuestions(
    skills: string[],
    resumeText?: string
): Promise<QuizQuestion[]> {
    if (!skills.length) {
        throw new Error("At least one skill must be selected.");
    }

    const MAX_SKILLS = Number(process.env.QUIZ_MAX_SKILLS ?? 3);
    if (skills.length > MAX_SKILLS) {
        throw new Error(`Please select up to ${MAX_SKILLS} skills to generate the quiz.`);
    }

    // Primary model from env (default: gemini-2.5-flash); fallback: gemini-2.5-flash-lite
    const primaryModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const modelNames = [primaryModel, "gemini-2.5-flash-lite"].filter(
        (m, i, arr) => arr.indexOf(m) === i  // deduplicate if env already set to lite
    );
    const totalQuestions = skills.length * 5;

    const prompt = `You are an expert technical assessor.

Generate a quiz for these skills:
${JSON.stringify(skills)}

Generate EXACTLY 5 questions per skill:
- 3 MEDIUM difficulty
- 2 HARD difficulty

${resumeText ? `Resume context (use lightly to personalize examples):\n"""\n${resumeText.slice(0, 2000)}\n"""\n` : ""}
Return ONLY valid JSON (no markdown, no explanation) as an array with EXACTLY ${totalQuestions} items:
[
  {
    "skill": "React",
    "question": "...",
    "options": ["Option A","Option B","Option C","Option D"],
    "correctIndex": 0,
    "difficulty": "MEDIUM"
  }
]

Rules:
- Each question must have exactly 4 options
- correctIndex is 0-based (0..3)
- difficulty must be "MEDIUM" or "HARD"
- Each item MUST include "skill" matching one of the provided skills exactly
- Vary the correct answer positions
- Do not add any text outside the JSON array`;

    const result = await geminiGenerateWithRetry(modelNames, prompt, 2);
    const text = result.response.text().trim();

    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed: Array<{
        skill: string;
        question: string;
        options: string[];
        correctIndex: number;
        difficulty: "MEDIUM" | "HARD";
    }> = JSON.parse(jsonStr);

    if (!Array.isArray(parsed) || parsed.length !== totalQuestions) {
        throw new Error(
            `AI returned invalid quiz payload. Expected ${totalQuestions} questions, got ${Array.isArray(parsed) ? parsed.length : "non-array"}.`
        );
    }

    let questionCounter = 1;
    return parsed.map((q) => ({
        id: `q${questionCounter++}`,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        difficulty: q.difficulty,
        skill: q.skill,
    }));
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
        // 1. Record the attempt
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

        // 2. Award tokens for hard-mode pass
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

        // 3. Upsert QuizVerifiedSkill for every skill in this attempt.
        //    We read each row first to compute the real bestScore (max), so we
        //    never accidentally overwrite a higher historical score.
        for (const skill of skills) {
            const existing = await tx.quizVerifiedSkill.findUnique({
                where: { userId_skill: { userId, skill } },
                select: { bestScore: true, verified: true },
            });

            const newBest = Math.max(existing?.bestScore ?? 0, score);
            // Once verified, never un-verify (a future fail must not clear it)
            const nowVerified = passed || (existing?.verified ?? false);
            const nowVerifiedAt = (passed && !existing?.verified) ? new Date() : undefined;

            await tx.quizVerifiedSkill.upsert({
                where: { userId_skill: { userId, skill } },
                create: {
                    userId,
                    skill,
                    verified: passed,
                    verifiedAt: passed ? new Date() : null,
                    bestScore: score,
                    attempts: 1,
                },
                update: {
                    verified: nowVerified,
                    ...(nowVerifiedAt ? { verifiedAt: nowVerifiedAt } : {}),
                    bestScore: newBest,
                    attempts: { increment: 1 },
                },
            });
        }
    });

    return { score, totalQuestions: total, passed, tokensEarned, breakdown };
}
