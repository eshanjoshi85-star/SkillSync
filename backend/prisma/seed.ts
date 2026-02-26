require("dotenv").config();
import { PrismaClient, SkillType, ProficiencyLevel } from "@prisma/client";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import bcrypt from "bcryptjs";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🌱 Starting SkillSync seed...\n");

    // ─── 1. Skills ────────────────────────────────────────────────
    const skillsData = [
        { name: "Java", category: "Programming" },
        { name: "Python", category: "Programming" },
        { name: "React", category: "Frontend" },
        { name: "Node.js", category: "Backend" },
        { name: "TypeScript", category: "Programming" },
        { name: "SQL", category: "Database" },
        { name: "Machine Learning", category: "AI/ML" },
        { name: "Data Structures", category: "Computer Science" },
    ];

    const skills: Record<string, string> = {};

    for (const skill of skillsData) {
        const upserted = await prisma.skill.upsert({
            where: { name: skill.name },
            update: {},
            create: skill,
        });
        skills[skill.name] = upserted.id;
        console.log(`   ✅ Skill seeded: ${skill.name} [${skill.category}]`);
    }

    // ─── 2. Test Mentor ───────────────────────────────────────────
    const passwordHash = await bcrypt.hash("mentor123", 10);

    const mentor = await prisma.user.upsert({
        where: { email: "mentor@skillsync.dev" },
        update: {},
        create: {
            email: "mentor@skillsync.dev",
            passwordHash,
            name: "Test Mentor",
            bio: "Senior developer with 5 years of experience in Java, Python, and React. Ready to teach!",
            tokenBalance: 50,
        },
    });
    console.log(`\n   ✅ Mentor seeded: ${mentor.name} (${mentor.email})`);

    // Assign teach skills to mentor
    const mentorTeachSkills = ["Java", "Python", "React"];
    for (const skillName of mentorTeachSkills) {
        await prisma.userSkill.upsert({
            where: {
                userId_skillId_type: {
                    userId: mentor.id,
                    skillId: skills[skillName],
                    type: SkillType.TEACH,
                },
            },
            update: {},
            create: {
                userId: mentor.id,
                skillId: skills[skillName],
                type: SkillType.TEACH,
                proficiencyLevel: ProficiencyLevel.ADVANCED,
            },
        });
        console.log(`      ↳ Can Teach: ${skillName}`);
    }

    // ─── 3. Test Learner ──────────────────────────────────────────
    const learnerHash = await bcrypt.hash("learner123", 10);

    const learner = await prisma.user.upsert({
        where: { email: "learner@skillsync.dev" },
        update: {},
        create: {
            email: "learner@skillsync.dev",
            passwordHash: learnerHash,
            name: "Test Learner",
            bio: "CS student looking to learn Java and React from experienced mentors.",
            tokenBalance: 10,
        },
    });
    console.log(`\n   ✅ Learner seeded: ${learner.name} (${learner.email})`);

    // Assign learn skills to learner
    const learnerLearnSkills = ["Java", "React"];
    for (const skillName of learnerLearnSkills) {
        await prisma.userSkill.upsert({
            where: {
                userId_skillId_type: {
                    userId: learner.id,
                    skillId: skills[skillName],
                    type: SkillType.LEARN,
                },
            },
            update: {},
            create: {
                userId: learner.id,
                skillId: skills[skillName],
                type: SkillType.LEARN,
                proficiencyLevel: ProficiencyLevel.BEGINNER,
            },
        });
        console.log(`      ↳ Wants to Learn: ${skillName}`);
    }

    console.log("\n──────────────────────────────────────────────");
    console.log("🎉 Seed completed successfully!");
    console.log("   Test credentials:");
    console.log("   Mentor  → mentor@skillsync.dev / mentor123");
    console.log("   Learner → learner@skillsync.dev / learner123");
    console.log("──────────────────────────────────────────────\n");
}

main()
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
