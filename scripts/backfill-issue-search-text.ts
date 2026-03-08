#!/usr/bin/env tsx

import { spawn } from 'node:child_process';

const CONVEX_URL = process.env.CONVEX_URL || 'http://localhost:8000';

async function backfillIssueSearchText() {
  const adminKey = process.env.CONVEX_ADMIN_KEY;

  if (!adminKey) {
    throw new Error('CONVEX_ADMIN_KEY is required to run internal migrations');
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        'convex',
        'run',
        'internal.migrations.index.backfillIssueSearchText',
        '{}',
        '--url',
        CONVEX_URL,
        '--admin-key',
        adminKey,
        '--typecheck',
        'disable',
        '--codegen',
        'disable',
      ],
      {
        stdio: 'inherit',
        env: process.env,
      },
    );

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Backfill command failed with exit code ${code ?? 1}`));
    });
  });
}

if (require.main === module) {
  backfillIssueSearchText().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export { backfillIssueSearchText };
