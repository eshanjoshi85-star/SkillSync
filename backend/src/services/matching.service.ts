import { prisma } from "../lib/prisma";

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
export async function findMatches(currentUserId: string): Promise<MatchResult[]> {
    // Get current user's skill profile
    const currentUserSkills = await prisma.userSkill.findMany({
        where: { userId: currentUserId },
        include: { skill: true },
    });

    const wantsToLearn = currentUserSkills
        .filter((s: { type: string }) => s.type === "LEARN")
        .map((s: { skillId: string }) => s.skillId);
    const canTeach = currentUserSkills
        .filter((s: { type: string }) => s.type === "TEACH")
        .map((s: { skillId: string }) => s.skillId);

    if (wantsToLearn.length === 0) return [];

    // Find users who can teach any skill the current user wants to learn
    const potentialTeachers = await prisma.userSkill.findMany({
        where: {
            skillId: { in: wantsToLearn },
            type: "TEACH",
            userId: { not: currentUserId },
        },
        include: {
            user: { select: { id: true, name: true, bio: true, tokenBalance: true } },
            skill: { select: { name: true } },
        },
    });

    // Group by user and collect matching skill names
    const matchMap = new Map<string, MatchResult & { isMutualMatch: boolean }>();

    for (const entry of potentialTeachers) {
        const uid = entry.user.id;
        if (!matchMap.has(uid)) {
            matchMap.set(uid, {
                userId: uid,
                name: entry.user.name,
                bio: entry.user.bio,
                tokenBalance: entry.user.tokenBalance,
                matchingSkills: [],
                isMutualMatch: false,
            });
        }
        matchMap.get(uid)!.matchingSkills.push(entry.skill.name);
    }

    // Check for mutual matches: potential teachers who also want to learn what you teach
    if (canTeach.length > 0) {
        const mutualLearners = await prisma.userSkill.findMany({
            where: {
                skillId: { in: canTeach },
                type: "LEARN",
                userId: { in: Array.from(matchMap.keys()) },
            },
        });
        const mutualUserIds = new Set(mutualLearners.map((s: { userId: string }) => s.userId));
        for (const [uid, match] of matchMap) {
            if (mutualUserIds.has(uid)) match.isMutualMatch = true;
        }
    }

    // Sort: mutual matches first, then by number of matching skills
    const results = Array.from(matchMap.values()).sort((a, b) => {
        if (a.isMutualMatch && !b.isMutualMatch) return -1;
        if (!a.isMutualMatch && b.isMutualMatch) return 1;
        return b.matchingSkills.length - a.matchingSkills.length;
    });

    return results;
}
