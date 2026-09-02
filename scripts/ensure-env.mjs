import { copyFileSync, existsSync } from "node:fs";

// `.env` is gitignored (it may hold an API key), so a fresh clone has no
// DATABASE_URL and every Prisma command fails with a validation error before
// the user has done anything wrong. Seed it from the committed example.

if (existsSync(".env")) {
  process.exit(0);
}

if (!existsSync(".env.example")) {
  console.error("No .env or .env.example found — cannot determine DATABASE_URL.");
  process.exit(1);
}

copyFileSync(".env.example", ".env");
console.log("Created .env from .env.example. Add ANTHROPIC_API_KEY there for one-click AI.");
