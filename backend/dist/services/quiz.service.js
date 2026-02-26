"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromResume = extractTextFromResume;
exports.generateQuizQuestions = generateQuizQuestions;
exports.saveQuizAttempt = saveQuizAttempt;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
const generative_ai_1 = require("@google/generative-ai");
const prisma_1 = require("../lib/prisma");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
/** Extract plain text from a PDF buffer using pdf-parse */
async function extractTextFromResume(buffer) {
    const data = await pdfParse(buffer);
    return data.text.trim();
}
/**
 * Use Gemini 1.5 Flash to generate quiz questions.
 * 1 skill  → 5 Qs (3 Medium, 2 Hard)
 * 2 skills → 10 Qs per pair: 4 Medium + 6 Hard split across skills
 */
async function generateQuizQuestions(skills, resumeText) {
    if (skills.length < 1 || skills.length > 2) {
        throw new Error("You must select 1 or 2 skills for the quiz.");
    }
    const questionsPerSkill = skills.length === 1
        ? [{ skill: skills[0], medium: 3, hard: 2 }]
        : [
            { skill: skills[0], medium: 2, hard: 3 },
            { skill: skills[1], medium: 2, hard: 3 },
        ];
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const allQuestions = [];
    let questionCounter = 1;
    for (const { skill, medium, hard } of questionsPerSkill) {
        const prompt = `You are an expert technical assessor for the skill: "${skill}".

Based on the candidate's resume context below, generate ${medium + hard} multiple-choice questions:
- ${medium} questions at MEDIUM difficulty
- ${hard} questions at HARD difficulty

Resume context:
"""
${resumeText.slice(0, 3000)}
"""

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
        const parsed = JSON.parse(jsonStr);
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
 *  Hard-mode bonus: 2 skills selected + passed ≥ 60% → awards +2 tokens via SYSTEM_BONUS.
 */
async function saveQuizAttempt(userId, skills, questions, answers) {
    let score = 0;
    const breakdown = questions.map((q) => {
        const yours = answers[q.id] ?? -1;
        const correct = yours === q.correctIndex;
        if (correct)
            score++;
        return { id: q.id, correct, correctIndex: q.correctIndex, yourIndex: yours };
    });
    const total = questions.length;
    const passed = score / total >= 0.6; // 60% pass threshold
    const isHardMode = skills.length === 2;
    const tokensEarned = passed && isHardMode ? 2 : 0;
    await prisma_1.prisma.$transaction(async (tx) => {
        // 1. Persist attempt record
        await tx.quizAttempt.create({
            data: {
                userId,
                skills,
                questions: questions,
                answers: answers,
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
//# sourceMappingURL=quiz.service.js.map