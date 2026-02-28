/**
 * extractSkills.ts
 * ----------------
 * Deterministic skill-keyword extractor.
 * No external deps – pure regex matching against a curated dictionary.
 */

interface SkillEntry {
    display: string;   // canonical display name returned to client
    pattern: RegExp;   // regex to match in normalised lowercase text
}

// Helper: escape a string for use in a regex
function esc(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a word-boundary-aware pattern.
// For tokens with special chars (C++, C#, Node.js) we do exact match surrounded
// by non-alphanumeric boundaries.
function boundary(token: string): RegExp {
    const escaped = esc(token.toLowerCase());
    return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
}

// Short / ambiguous tokens get stricter start-of-word or space/comma separation
function strict(token: string): RegExp {
    const escaped = esc(token.toLowerCase());
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
}

const SKILLS: SkillEntry[] = [
    // ── Languages ─────────────────────────────────────────────────────────────
    { display: "Java", pattern: /(?<![a-z])java(?!script|[a-z])/i },
    { display: "JavaScript", pattern: boundary("javascript") },
    { display: "TypeScript", pattern: boundary("typescript") },
    { display: "Python", pattern: boundary("python") },
    { display: "C++", pattern: /(?<![a-z0-9])c\+\+(?![a-z0-9])/i },
    { display: "C#", pattern: /(?<![a-z0-9])c#(?![a-z0-9])/i },
    { display: "Go", pattern: strict("go") },
    { display: "Rust", pattern: boundary("rust") },
    { display: "Kotlin", pattern: boundary("kotlin") },
    { display: "Swift", pattern: boundary("swift") },
    { display: "Ruby", pattern: boundary("ruby") },
    { display: "PHP", pattern: boundary("php") },
    { display: "Scala", pattern: boundary("scala") },

    // ── Web / Frameworks ──────────────────────────────────────────────────────
    { display: "React", pattern: boundary("react") },
    { display: "Next.js", pattern: /(?<![a-z0-9])next\.js(?![a-z0-9])/i },
    { display: "Angular", pattern: boundary("angular") },
    { display: "Vue", pattern: boundary("vue") },
    { display: "Node.js", pattern: /(?<![a-z0-9])node\.js(?![a-z0-9])/i },
    { display: "Express", pattern: boundary("express") },
    { display: "Spring Boot", pattern: /spring[\s\-]?boot/i },
    { display: "Spring", pattern: /(?<![a-z])spring(?!\s*boot)(?![a-z])/i },
    { display: "Hibernate", pattern: boundary("hibernate") },
    { display: "Django", pattern: boundary("django") },
    { display: "Flask", pattern: boundary("flask") },
    { display: "FastAPI", pattern: boundary("fastapi") },
    { display: "HTML", pattern: boundary("html") },
    { display: "CSS", pattern: boundary("css") },
    { display: "Tailwind", pattern: /tailwind/i },

    // ── Databases ─────────────────────────────────────────────────────────────
    { display: "JDBC", pattern: boundary("jdbc") },
    { display: "SQL", pattern: /(?<![a-z])sql(?![a-z])/i },
    { display: "PostgreSQL", pattern: boundary("postgresql") },
    { display: "MySQL", pattern: boundary("mysql") },
    { display: "MongoDB", pattern: boundary("mongodb") },
    { display: "Redis", pattern: boundary("redis") },
    { display: "Oracle", pattern: boundary("oracle") },
    { display: "DBMS", pattern: boundary("dbms") },

    // ── Cloud / DevOps ────────────────────────────────────────────────────────
    { display: "AWS", pattern: boundary("aws") },
    { display: "Azure", pattern: boundary("azure") },
    { display: "GCP", pattern: boundary("gcp") },
    { display: "Docker", pattern: boundary("docker") },
    { display: "Kubernetes", pattern: boundary("kubernetes") },
    { display: "CI/CD", pattern: /ci[\s\/\-]?cd/i },
    { display: "Jenkins", pattern: boundary("jenkins") },
    { display: "GitHub Actions", pattern: /github[\s\-]?actions/i },
    { display: "Git", pattern: /(?<![a-z])git(?!hub|lab|[a-z])/i },
    { display: "Linux", pattern: boundary("linux") },

    // ── CS Concepts ───────────────────────────────────────────────────────────
    { display: "Operating Systems", pattern: /operating\s+systems?/i },
    { display: "OS", pattern: /(?<![a-z])os(?![a-z])/i },
    { display: "OOP", pattern: /(?<![a-z])oop(?![a-z])/i },
    { display: "DSA", pattern: /(?<![a-z])dsa(?![a-z])/i },
    { display: "Data Structures", pattern: /data\s+structures?/i },
    { display: "Algorithms", pattern: boundary("algorithms") },
    { display: "System Design", pattern: /system\s+design/i },
    { display: "Computer Networks", pattern: /computer\s+networks?/i },

    // ── APIs / Other ──────────────────────────────────────────────────────────
    { display: "REST API", pattern: /rest\s*(?:api|apis|ful)?/i },
    { display: "GraphQL", pattern: boundary("graphql") },
    { display: "Machine Learning", pattern: /machine\s+learning/i },
    { display: "Deep Learning", pattern: /deep\s+learning/i },
    { display: "Postman", pattern: boundary("postman") },
    { display: "Servlets", pattern: boundary("servlets") },
];

/**
 * Extract skills from raw resume text.
 * Returns the matched display names, deduplicated, in dictionary order.
 */
export function extractSkillsFromText(text: string): string[] {
    const found: string[] = [];
    for (const entry of SKILLS) {
        if (entry.pattern.test(text)) {
            found.push(entry.display);
        }
    }
    return found;
}
