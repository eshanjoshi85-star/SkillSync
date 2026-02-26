import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";
import ws from "ws";

async function testPool() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_O8zflpDLI2dP@ep-rapid-mud-ailu7mcc-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require" });
    const adapter = new PrismaNeon(pool as any);
    try {
        const res = await adapter.queryRaw({ query: "SELECT 1 as ping", values: [] });
        console.log("Adapter query SUCCESS!", res);
    } catch (e: any) {
        console.error("Adapter query ERROR!", e.stack);
    }
}
testPool();
