import { z } from "zod";
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string(),
  APP_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

// Load environment variables from .env files **before** validation.
// Precedence (first wins) mirrors Next.js:
// 1. `.env.<NODE_ENV>.local`
// 2. `.env.local`
// 3. `.env.<NODE_ENV>`
// 4. `.env`
const cwd = process.cwd();
const nodeEnv = process.env.NODE_ENV ?? "development";
const envFiles = [
  `.env.${nodeEnv}.local`,
  ".env.local",
  `.env.${nodeEnv}`,
  ".env",
];

for (const file of envFiles) {
  const path = resolve(cwd, file);
  if (existsSync(path)) {
    // `override: false` ensures first-loaded file wins (higher precedence files appear earlier).
    config({ path, override: false });
  }
}

// Parse and ensure all required env vars are present
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("\n================ ENV VALIDATION ERROR ================");
  console.error("❌ Invalid environment variables:");
  console.error(_env.error);
  console.error("Field errors:", _env.error.flatten().fieldErrors);
  console.error("Current process.env values:");
  for (const k of Object.keys(envSchema.shape)) {
    // Only print relevant env vars
    console.error(`  ${k} =`, process.env[k]);
  }
  console.error("======================================================\n");
  throw new Error("Invalid environment variables. See logs above.");
}

export const env = {
  ..._env.data,
  BETTER_AUTH_URL: _env.data.BETTER_AUTH_URL ?? _env.data.APP_URL,
};
