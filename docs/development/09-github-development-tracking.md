# GitHub Development Tracking: Test Guide

This guide explains how to test and debug the GitHub development tracking flow in Vector.

Use it when you need to verify:

- GitHub App or token fallback setup
- repo sync and repo selection
- manual linking from an issue
- automatic linking from regex matches
- webhook-driven PR and GitHub issue state updates
- commit linking and child-issue commit rollups
- unlink and suppression behavior

## Quick Setup Checklist

If you just want the shortest possible path, do this:

1. Create a GitHub App in `GitHub -> Settings -> Developer settings -> GitHub Apps`.
2. Copy these values from GitHub:
   - `App ID` -> use as `GITHUB_APP_ID`
   - generated `.pem` private key -> use as `GITHUB_APP_PRIVATE_KEY`
   - webhook secret you typed during app creation -> use as `GITHUB_WEBHOOK_SECRET`
3. Generate an encryption key locally:

   ```bash
   openssl rand -base64 32
   ```

   Use that as `GITHUB_TOKEN_ENCRYPTION_KEY`.

4. Set all 4 values in your Convex environment.
5. Install the GitHub App on the repo owner you want to test.
6. Copy the installation details:
   - installation ID from the GitHub installation URL
   - account login from the installed user/org name
   - account type as `User` or `Organization`
7. Open Vector at `/{orgSlug}/settings`.
8. In the `GitHub` section:
   - paste installation ID
   - paste account login
   - paste account type
   - click `Save`
9. Click `Sync repos`.
10. Select at least one repo.
11. Open an issue and paste a GitHub PR, issue, or commit URL into `Development`.
12. If that works, move on to webhook and auto-link testing.

## Prerequisites

Run the app locally:

```bash
pnpm run convex:dev
pnpm run dev
```

Set these environment variables before testing GitHub automation:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

These values are used by the Convex backend, so set them in your Convex environment for the local deployment you are testing.

Notes:

- `GITHUB_TOKEN_ENCRYPTION_KEY` is required to store admin-pasted token fallbacks securely.
- If you do not want to wire the GitHub App yet, you can still test most flows with the token fallback from the org settings UI.
- The webhook endpoint is `POST /webhooks/github`.

## Step-by-Step GitHub Setup

If you are new to GitHub Apps, do this in order.

### 1. Create a GitHub App

In GitHub:

1. Open `GitHub -> Settings -> Developer settings -> GitHub Apps`.
2. Click `New GitHub App`.
3. Fill in the form as described below.
4. Under repository permissions, give the app at least:
   - `Contents`: `Read-only`
   - `Pull requests`: `Read-only`
   - `Issues`: `Read-only`
   - `Metadata`: GitHub Apps always have metadata access; GitHub docs note metadata is always available at least read-only
5. Under webhook subscriptions, enable:
   - `Pull request`
   - `Issues`
   - `Push`
   - `Installation`
   - `Installation repositories`
6. Create the app.

### 1A. What to fill in on the GitHub form

This maps to the fields in your screenshot.

#### `GitHub App name`

What to enter:

- use a unique name such as `vector-local-syed`

Tips:

- GitHub App names must be unique enough not to collide with existing apps and users
- do not use just `vector` unless GitHub accepts it
- if you are testing locally, include your name or team name

#### Description

What to enter:

- something simple like `GitHub sync for Vector local testing`

This is only descriptive. It does not affect the integration.

#### `Homepage URL`

What to enter:

- use a safe public URL such as your repo URL
- example: `https://github.com/xrehpicx/vector`

Recommended:

- use a public repo/docs URL, not `http://localhost:3000`

Reason:

- GitHub’s docs warn not to put sensitive internal URLs into app registration fields
- this field is only informational for users

#### `Callback URL`

What to do:

- leave it blank
- if GitHub auto-added an empty callback row, remove it if the UI allows

Reason:

- Vector does not currently use GitHub’s user OAuth flow during installation
- callback URLs are only needed if you enable user authorization during install

#### `Expire user authorization tokens`

What to do:

- leave the default alone

Reason:

- Vector is not using user authorization tokens for this setup
- this setting is not important for the current integration

#### `Request user authorization (OAuth) during installation`

What to do:

- keep this unchecked

Reason:

- Vector authenticates as the app installation, not as each GitHub user
- if you enable this, GitHub expects a callback URL and a user auth flow that Vector does not currently implement

#### `Enable Device Flow`

What to do:

- keep this unchecked

Reason:

- Vector is not a CLI device-auth app in this flow

### 1B. Webhook settings

Scroll to the webhook section of the form and set:

#### `Active`

- turn this on

#### `Webhook URL`

What to enter:

- your public tunnel URL plus `/webhooks/github`

Example:

```text
https://your-ngrok-or-cloudflared-url/webhooks/github
```

If you put just the site URL without `/webhooks/github`, GitHub will happily send events to the wrong place and then act shocked when nothing works.

#### `Webhook secret`

What to enter:

- any long random string that you generate and save

Example:

```bash
openssl rand -base64 32
```

Use the exact same value for:

- the GitHub App webhook secret field
- `GITHUB_WEBHOOK_SECRET` in Convex

### 1C. Permissions

In the repository permissions section, set:

- `Contents` -> `Read-only`
- `Issues` -> `Read-only`
- `Pull requests` -> `Read-only`

You do not need write permissions for Vector’s current GitHub tracking flow because it only reads PRs, issues, commits, and repo metadata.

### 1D. Subscribe to webhook events

In the webhook event subscriptions section, enable:

- `Pull request`
- `Issues`
- `Push`
- `Installation`
- `Installation repositories`

These are the events Vector’s backend currently processes.

### 1E. Post-installation settings

If GitHub shows a `Setup URL` section:

- leave `Setup URL` blank
- leave `Redirect on update` off

Reason:

- Vector’s current settings flow is manual in the org settings page
- it does not yet implement a post-install redirect flow

### 1F. App visibility

For local testing, prefer a private app:

- `Only on this account` if the repos live under the same personal account or org that owns the app

Important:

- if your test repos are in a GitHub organization, the easiest setup is to create the app under that same organization
- GitHub’s docs say a private app can only be installed on the account that owns it
- if you create it under your personal account and want to install it elsewhere, you may need broader visibility

### 2. Get the values for the required environment variables

#### `GITHUB_APP_ID`

Where to get it:

1. Open your GitHub App.
2. On the app overview page, look for `App ID`.

That number is the value for `GITHUB_APP_ID`.

#### `GITHUB_APP_PRIVATE_KEY`

Where to get it:

1. Open your GitHub App.
2. Go to `Private keys`.
3. Click `Generate a private key`.
4. GitHub downloads a `.pem` file.

That `.pem` file content is the value for `GITHUB_APP_PRIVATE_KEY`.

Important:

- keep the full file content
- include the `-----BEGIN ...-----` and `-----END ...-----` lines
- when storing it in Convex env, use escaped `\n` line breaks

#### `GITHUB_WEBHOOK_SECRET`

Where to get it:

- this is the exact secret you entered in the GitHub App webhook settings during app creation

Use the same value in GitHub and Convex. If they differ, webhook signature verification fails immediately, because apparently security is rude like that.

#### `GITHUB_TOKEN_ENCRYPTION_KEY`

Where to get it:

- generate your own random secret locally

Example:

```bash
openssl rand -base64 32
```

Use the generated value as `GITHUB_TOKEN_ENCRYPTION_KEY`.

### 3. Set the environment variables in Convex

The easiest approach is the Convex dashboard for your local deployment, but the CLI works too.

#### Option A: Convex dashboard

1. Open your Convex deployment dashboard.
2. Go to environment variables.
3. Add:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `GITHUB_WEBHOOK_SECRET`
   - `GITHUB_TOKEN_ENCRYPTION_KEY`

For `GITHUB_APP_PRIVATE_KEY`:

1. open the downloaded `.pem` file
2. convert the line breaks to literal `\n`
3. paste that single escaped value into Convex

#### Option B: Convex CLI

Example commands:

```bash
pnpm convex env set GITHUB_APP_ID 123456
pnpm convex env set GITHUB_WEBHOOK_SECRET your-webhook-secret
pnpm convex env set GITHUB_TOKEN_ENCRYPTION_KEY "$(openssl rand -base64 32)"
pnpm convex env set GITHUB_APP_PRIVATE_KEY "$(perl -0pe 's/\n/\\n/g' ~/Downloads/your-github-app.private-key.pem)"
```

The private key command reads the `.pem` file and converts real line breaks into escaped `\n`, which is what the backend expects.

### 4. Install the GitHub App on your repo or org

In GitHub:

1. Open your GitHub App.
2. Click `Install App`.
3. Choose the GitHub user or organization that owns the repos you want to test.
4. Choose either:
   - `All repositories`
   - or `Only select repositories`
5. Install the app.

### 5. Get the installation metadata Vector needs

Vector settings currently ask for:

- installation ID
- installation account login
- installation account type

Here is how to get each one.

#### Installation ID

Where to get it:

1. Open the installed app in GitHub.
2. Look at the browser URL.

Example:

```text
https://github.com/settings/installations/12345678
```

In that URL, `12345678` is the installation ID.

#### Installation account login

Where to get it:

- this is the GitHub username or organization name where the app was installed

Examples:

- `acme`
- `your-user-name`

#### Installation account type

Use one of:

- `Organization`
- `User`

If you installed the app on a GitHub organization, use `Organization`.
If you installed it on your personal GitHub account, use `User`.

### 6. Save the GitHub setup in Vector

In Vector:

1. Open `/{orgSlug}/settings`.
2. In the `GitHub` section:
   - paste the installation ID
   - paste the account login
   - paste the account type
3. Click `Save`.
4. Click `Sync repos`.
5. Select at least one repo.

Expected result:

- selected repos become available for linking
- the app connection badge shows as connected
- repo sync health starts showing real values

### 7. Optional: use token fallback instead of the GitHub App

If you want the simplest possible test setup, use a GitHub token fallback.

Create a fine-grained personal access token in GitHub with access to the repos you want to test and at least:

- metadata read
- contents read
- pull requests read
- issues read

Then:

1. open `/{orgSlug}/settings`
2. paste the token into `Token Fallback`
3. click `Save`
4. click `Sync repos`
5. select the repos you want Vector to scan

## One-Time Setup

### 1. Configure GitHub in Vector

Open:

- `/{orgSlug}/settings`

In the `GitHub` section:

1. Save GitHub App installation metadata.
2. Or paste a GitHub token fallback.
3. Click `Sync repos`.
4. Select at least one repository.

Expected result:

- the repo appears in the selected list
- app/token status badges appear
- webhook/reconcile health fields stop looking empty and sad

### 2. Confirm your issue workflow states exist

Automation expects these workflow state types to exist in the org:

- `todo`
- `in_progress`
- `done`
- `canceled`

If one of those types is missing, GitHub automation cannot move issues correctly.

## Smoke Tests

### Test 1: Manual link from issue detail

1. Open an issue detail page.
2. In `Development`, paste one of:
   - a GitHub PR URL
   - a GitHub issue URL
   - a GitHub commit URL
3. Click `Link`.

Expected result:

- the artifact appears in the `Development` section
- the artifact shows repo, status, and last sync time
- manual links show a `manual` badge

If it fails:

- make sure the repo is selected in org settings
- make sure the URL points to a selected repo
- make sure GitHub auth is configured

### Test 2: Auto-link a PR by regex

1. Create a Vector issue like `ENG-123`.
2. Create a GitHub PR in a selected repo.
3. Put `ENG-123` in one of:
   - PR title
   - PR body
   - head branch name
4. Deliver the webhook or wait for reconciliation.

Expected result:

- the PR appears automatically in the issue `Development` section
- it shows an `auto` badge

Matching rules:

- matching is case-insensitive
- the issue key must be a standalone token
- comments are not scanned in v1

### Test 3: PR state automation

With an auto-linked or manually linked PR:

1. Mark it draft.
2. Open it.
3. Close it without merging.
4. Reopen it.
5. Merge it.

Expected issue workflow changes:

- `draft` -> `in_progress`
- `open` -> `in_progress`
- `closed` and not merged -> `canceled`
- `reopened` -> `in_progress`
- `merged` -> `done`

Check these surfaces:

- issue detail header state selector
- issues table
- issues kanban
- project issue views
- team issue views

### Test 4: GitHub issue state automation

This only matters when no linked PR is currently controlling the issue.

1. Create a GitHub issue in a selected repo.
2. Put the Vector issue key in the GitHub issue title or body.
3. Open, close, and reopen the GitHub issue.

Expected issue workflow changes:

- `open` -> `todo`
- `reopened` -> `todo`
- `closed` -> `done`

### Test 5: Commit linking on a child issue

1. Create a parent issue, for example `ENG-200`.
2. Create a child issue under it, for example `ENG-201`.
3. Push a commit whose message contains `ENG-201`.
4. Deliver the push webhook or wait for reconciliation.

Expected result:

- the commit links directly to `ENG-201`
- `ENG-201` shows the commit in its `Development` section
- `ENG-200` shows the commit in `Child Issue Commits`
- the parent does not get a direct commit link unless its own key is referenced

### Test 6: Suppression

1. Let an artifact auto-link to an issue.
2. In the issue `Development` section, click `Suppress`.
3. Re-deliver the webhook or wait for reconciliation.

Expected result:

- the artifact stays unlinked
- it does not come back on the next sync

### Test 7: Refresh and stale data

1. Link a PR.
2. Let the cached data become old, or just change the PR in GitHub.
3. Open the issue page.
4. Click `Refresh` if needed.

Expected result:

- stale artifacts are marked `Stale`
- opening the page triggers a refresh when the cache is old
- manual refresh updates the displayed status

## Webhook Testing

The webhook endpoint is:

```text
/webhooks/github
```

Events handled in v1:

- `pull_request`
- `issues`
- `push`
- `installation`
- `installation_repositories`

Recommended local test loop:

1. expose your local app with a tunnel
2. point the GitHub App webhook to your tunnel URL
3. use GitHub webhook delivery logs to redeliver events after code changes

If webhook delivery is failing:

- verify `GITHUB_WEBHOOK_SECRET`
- verify the webhook points to the correct environment
- verify the repo is selected in Vector
- verify the GitHub App or token has access to that repo

## Reconcile Testing

The reconcile job runs every 10 minutes.

Use it to test:

- missed webhook recovery
- newly discoverable links in recent PRs/issues/commits
- repo access changes

Expected behavior:

- recent artifacts from the last 14 days are refreshed
- linked artifacts are refreshed even if webhooks were missed

## Debug Checklist

### Manual link says repo is not connected

Check:

- the repo exists in org settings
- the repo is selected
- the URL matches the repo exactly

### Artifact never auto-links

Check:

- the issue key is in PR title/body/branch, commit message, or GitHub issue title/body
- the repo is selected
- the webhook event actually arrived
- the artifact is recent enough for reconcile

### Issue state does not move

Check:

- the org has `todo`, `in_progress`, `done`, and `canceled` workflow state types
- the artifact link is active
- a linked PR is not overriding the GitHub issue state

### Artifact reappears after unlink

Check:

- you used `Suppress` on an auto-linked artifact
- you did not use plain unlink on something that is still auto-matchable

### UI shows stale or old status

Check:

- the `Refresh` button on the issue page
- the org settings sync health
- webhook delivery logs

## Useful Files

When debugging, start here:

- `convex/github/actions.ts`
- `convex/github/mutations.ts`
- `convex/github/queries.ts`
- `convex/github/shared.ts`
- `src/components/issues/issue-development-section.tsx`
- `src/components/organization/github-integration-settings.tsx`

## Recommended Quick Test Order

If you only want a fast sanity pass:

1. configure GitHub in org settings
2. sync repos and select one repo
3. manually link one PR URL
4. auto-link one PR with an issue key in the title
5. close, reopen, and merge that PR
6. push one commit for a child issue
7. suppress one auto-linked artifact and confirm it stays gone
