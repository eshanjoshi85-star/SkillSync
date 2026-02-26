export interface MatchResult {
    userId: string;
    name: string;
    bio: string | null;
    tokenBalance: number;
    matchingSkills: string[];
}
/**
 * Matching Engine: finds users who can teach a skill the current user wants to learn,
 * and who want to learn a skill that the current user can teach.
 * Mutual-match candidates are ranked first.
 */
export declare function findMatches(currentUserId: string): Promise<MatchResult[]>;
//# sourceMappingURL=matching.service.d.ts.map