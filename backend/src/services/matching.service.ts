import { prisma } from "../lib/prisma.js";

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
 */
export async function findMatches(currentUserId: string): Promise<MatchResult[]> {
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

    const results = Array.from(matchMap.values()).sort((a, b) => {
        if (a.isMutualMatch && !b.isMutualMatch) return -1;
        if (!a.isMutualMatch && b.isMutualMatch) return 1;
        return b.matchingSkills.length - a.matchingSkills.length;
    });

    return results;
}
