'use node';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  randomBytes,
} from 'node:crypto';
import { SignJWT } from 'jose';

const GITHUB_API_BASE = 'https://api.github.com';

function getEncryptionKey() {
  const raw =
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (!raw) {
    throw new Error('Missing GITHUB_TOKEN_ENCRYPTION_KEY');
  }

  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted]
    .map(part => part.toString('base64url'))
    .join('.');
}

export function decryptSecret(payload: string) {
  const [ivPart, authTagPart, encryptedPart] = payload.split('.');
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('Invalid encrypted secret payload');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function fingerprintSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex').slice(0, 12);
}

export function generateGitHubWebhookSecret() {
  return randomBytes(32).toString('base64url');
}

export function verifyGitHubWebhookSignature(
  body: string,
  signature: string | null,
  webhookSecret?: string,
) {
  const secret = webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('Missing GITHUB_WEBHOOK_SECRET');
  }
  if (!signature) return false;

  const expected = `sha256=${createHmac('sha256', secret)
    .update(body)
    .digest('hex')}`;

  return expected === signature;
}

async function createGitHubAppJwt(opts?: {
  appId?: string;
  privateKey?: string;
}) {
  const appId = opts?.appId ?? process.env.GITHUB_APP_ID;
  const privateKey = (
    opts?.privateKey ?? process.env.GITHUB_APP_PRIVATE_KEY
  )?.replace(/\\n/g, '\n');

  if (!appId || !privateKey) {
    throw new Error('Missing GitHub App credentials');
  }

  const key = createPrivateKey({
    key: privateKey,
    format: 'pem',
  });
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(appId)
    .sign(key);
}

async function requestGitHub<T>(
  path: string,
  init: RequestInit & { token: string },
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${init.token}`,
      'User-Agent': 'vector-github-integration/1.0',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function createInstallationAccessToken(
  installationId: number,
  appCredentials?: { appId?: string; privateKey?: string },
) {
  const jwt = await createGitHubAppJwt(appCredentials);
  const response = await requestGitHub<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      token: jwt,
    },
  );
  return response.token;
}

export async function withGitHubToken<T>(args: {
  installationId?: number | null;
  fallbackToken?: string | null;
  appCredentials?: { appId?: string; privateKey?: string };
  run: (token: string) => Promise<T>;
}) {
  if (args.installationId) {
    try {
      const token = await createInstallationAccessToken(
        args.installationId,
        args.appCredentials,
      );
      return await args.run(token);
    } catch (error) {
      if (!args.fallbackToken) {
        throw error;
      }
    }
  }

  if (!args.fallbackToken) {
    throw new Error('No GitHub token available');
  }

  return await args.run(args.fallbackToken);
}

export function parseGitHubUrl(
  value: string,
):
  | { type: 'pull_request'; owner: string; repo: string; number: number }
  | { type: 'issue'; owner: string; repo: string; number: number }
  | { type: 'commit'; owner: string; repo: string; sha: string }
  | null {
  try {
    const url = new URL(value);
    if (url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 4) return null;

    const [owner, repo, kind, identifier] = parts;
    if (kind === 'pull' && identifier) {
      return {
        type: 'pull_request',
        owner,
        repo,
        number: Number(identifier),
      };
    }
    if (kind === 'issues' && identifier) {
      return {
        type: 'issue',
        owner,
        repo,
        number: Number(identifier),
      };
    }
    if (kind === 'commit' && identifier) {
      return {
        type: 'commit',
        owner,
        repo,
        sha: identifier,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function listInstallationRepositories(token: string) {
  const repositories: Array<{
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    pushed_at: string | null;
    owner: {
      login: string;
    };
  }> = [];

  let page = 1;
  while (true) {
    const response = await requestGitHub<{
      repositories: Array<{
        id: number;
        node_id: string;
        name: string;
        full_name: string;
        private: boolean;
        default_branch: string;
        pushed_at: string | null;
        owner: {
          login: string;
        };
      }>;
    }>(`/installation/repositories?per_page=100&page=${page}`, {
      method: 'GET',
      token,
    });

    repositories.push(...response.repositories);
    if (response.repositories.length < 100) {
      break;
    }

    page += 1;
  }

  return { repositories };
}

export async function fetchPullRequest(
  token: string,
  owner: string,
  repo: string,
  number: number,
) {
  return await requestGitHub<any>(`/repos/${owner}/${repo}/pulls/${number}`, {
    method: 'GET',
    token,
  });
}

export async function fetchIssue(
  token: string,
  owner: string,
  repo: string,
  number: number,
) {
  return await requestGitHub<any>(`/repos/${owner}/${repo}/issues/${number}`, {
    method: 'GET',
    token,
  });
}

export async function fetchCommit(
  token: string,
  owner: string,
  repo: string,
  sha: string,
) {
  return await requestGitHub<any>(`/repos/${owner}/${repo}/commits/${sha}`, {
    method: 'GET',
    token,
  });
}

export async function listRecentPullRequests(
  token: string,
  owner: string,
  repo: string,
) {
  return await requestGitHub<any[]>(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=20`,
    {
      method: 'GET',
      token,
    },
  );
}

export async function listRecentIssues(
  token: string,
  owner: string,
  repo: string,
) {
  return await requestGitHub<any[]>(
    `/repos/${owner}/${repo}/issues?state=all&sort=updated&direction=desc&per_page=20`,
    {
      method: 'GET',
      token,
    },
  );
}

export async function listRecentCommits(
  token: string,
  owner: string,
  repo: string,
  sinceIso: string,
) {
  return await requestGitHub<any[]>(
    `/repos/${owner}/${repo}/commits?per_page=20&since=${encodeURIComponent(sinceIso)}`,
    {
      method: 'GET',
      token,
    },
  );
}
