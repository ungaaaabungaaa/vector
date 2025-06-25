import { spawnSync } from "node:child_process";
import { exit, platform } from "node:process";

function run(cmd: string, args: string[]) {
  console.log(`\n▶️  Running: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    // On Windows we need a shell for commands like pnpm and docker compose
    shell: platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`❌  Step failed with exit code ${result.status}. Aborting.`);
    exit(result.status ?? 1);
  }
}

console.log(
  "\n🛠️  Starting AIKP project setup\n----------------------------------",
);

// 1) Install deps
run("pnpm", ["install"]);

// 2) Start (or ensure) Postgres container
run("docker", ["compose", "-f", "docker-compose.dev-postgres.yml", "up", "-d"]);

// 3) Push migrations to the database
run("pnpm", ["run", "db:push"]);

// 4) Prepare Husky hooks & other post-install tasks
run("pnpm", ["run", "prepare"]);

console.log(
  "\n✅  Project setup complete! You can now run 'pnpm dev' to start the app.\n",
);
