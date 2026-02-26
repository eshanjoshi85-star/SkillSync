require("dotenv").config();
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
console.log("👉 DATABASE_URL at Pool creation is:", process.env.DATABASE_URL);
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function testDatabaseConnection() {
    console.log("\n🔍 Testing Neon PostgreSQL connection...");
    try {
        // Simple read ping to the database
        await prisma.$queryRaw`SELECT 1 as ping`;
        console.log("✅ Database connection: SUCCESSFUL");

        // Try counting users as a real-world query
        const userCount = await prisma.user.count();
        console.log(`✅ Database read test: PASSED — ${userCount} users found`);

        // Try counting skills
        const skillCount = await prisma.skill.count();
        console.log(`✅ Database schema check: PASSED — ${skillCount} skills found`);

        return true;
    } catch (error: any) {
        console.error("❌ Database connection: FAILED");
        console.error("   Error:", error.message);
        return false;
    }
}

async function testGeminiConnection() {
    console.log("\n🤖 Testing Gemini API connection...");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY is not set in .env");
        return false;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(
            "Reply with exactly: SKILLSYNC_PING_OK"
        );
        const text = result.response.text().trim();

        if (text.includes("SKILLSYNC_PING_OK")) {
            console.log("✅ Gemini API connection: SUCCESSFUL");
            console.log(`   Model response: "${text}"`);
        } else {
            console.log("✅ Gemini API connection: REACHABLE (unexpected response)");
            console.log(`   Model response: "${text}"`);
        }
        return true;
    } catch (error: any) {
        console.error("❌ Gemini API connection: FAILED");
        console.error("   Error:", error.message);
        return false;
    }
}

async function main() {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║    SkillSync — Cloud Connection Test     ║");
    console.log("╚══════════════════════════════════════════╝");

    const dbOk = await testDatabaseConnection();
    const geminiOk = await testGeminiConnection();

    console.log("\n──────────────────────────────────────────");
    console.log("📊 Summary:");
    console.log(`   Neon PostgreSQL : ${dbOk ? "✅ Connected" : "❌ Failed"}`);
    console.log(`   Gemini API      : ${geminiOk ? "✅ Connected" : "❌ Failed"}`);
    console.log("──────────────────────────────────────────");

    if (dbOk && geminiOk) {
        console.log("\n🎉 All systems are GO! SkillSync backend is cloud-ready.\n");
    } else {
        console.log("\n⚠️  Some connections failed. Check the errors above.\n");
        process.exit(1);
    }
}

main()
    .catch((err) => {
        console.error("Fatal error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
