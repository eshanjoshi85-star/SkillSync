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
export declare function extractTextFromResume(buffer: Buffer): Promise<string>;
/**
 * Use Gemini 1.5 Flash to generate quiz questions.
 * 1 skill  → 5 Qs (3 Medium, 2 Hard)
 * 2 skills → 10 Qs per pair: 4 Medium + 6 Hard split across skills
 */
export declare function generateQuizQuestions(skills: string[], resumeText: string): Promise<QuizQuestion[]>;
/** Score a submitted quiz and persist the attempt.
 *  Hard-mode bonus: 2 skills selected + passed ≥ 60% → awards +2 tokens via SYSTEM_BONUS.
 */
export declare function saveQuizAttempt(userId: string, skills: string[], questions: QuizQuestion[], answers: Record<string, number>): Promise<{
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
}>;
//# sourceMappingURL=quiz.service.d.ts.map