# Git Recovery — Setup Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Git installed
- A GitHub account

## 1. GitHub App Setup

### Create the GitHub App

1. Go to [GitHub Developer Settings](https://github.com/settings/apps)
2. Click **New GitHub App**
3. Fill in the following:

| Field | Value |
|-------|-------|
| **App name** | `git-recovery` (or your preferred name) |
| **Homepage URL** | `http://localhost:3000` |
| **Callback URL** | `http://localhost:3000/api/auth/callback` |
| **Request user authorization (OAuth) during installation** | ✅ Checked |
| **Webhook** | ❌ Uncheck "Active" (not needed) |

### Permissions Required

Under **Repository Permissions**:
- **Contents**: Read & Write
- **Pull Requests**: Read & Write  
- **Metadata**: Read-only

Under **Account permissions**:
- None required

### After Creation

1. Note your **App ID** (shown at the top of app settings)
2. Note your **Client ID** and generate a **Client Secret**
3. Generate a **Private Key** (.pem file):
   - Scroll to the bottom → "Private keys" → "Generate a private key"
   - Base64-encode the .pem file:
     ```bash
     # Linux/Mac
     base64 -w 0 your-app.private-key.pem
     
     # Windows (PowerShell)
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("your-app.private-key.pem"))
     ```
   - Set this as `GITHUB_APP_PRIVATE_KEY` in `.env`

### Install the App

1. Go to your app's public page: `https://github.com/apps/your-app-name`
2. Click **Install**
3. Select repositories to grant access to

## 2. Database Setup

Ensure PostgreSQL is running, then create a database:

```sql
CREATE DATABASE git_recovery;
```

Update `DATABASE_URL` in `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/git_recovery
```

## 3. Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | Your GitHub App ID |
| `GITHUB_CLIENT_ID` | OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | OAuth Client Secret |
| `GITHUB_APP_PRIVATE_KEY` | Base64-encoded PEM private key |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random string, 32+ characters |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` |
| `AI_BASE_URL` | *(Optional)* OpenAI-compatible endpoint |
| `AI_API_KEY` | *(Optional)* API key for AI provider |

## 4. Run the Application

```bash
# Install dependencies
npm install

# Generate Prisma client & run migrations
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

Visit `http://localhost:3000` to get started.

## 5. Usage Flow

1. Click **Get Started with GitHub** → redirects to GitHub OAuth
2. Authorize the app → redirected to dashboard
3. If the GitHub App isn't installed yet, you'll be prompted to install it
4. Select a repository from the dropdown
5. Configure dates, intensity, target file, and content
6. Optionally enable AI commit messages
7. Toggle **Dry Run** to preview what would happen
8. Click **Start Backfill** to execute

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "GitHub App not installed" | Install the app on your account/org via the app's public page |
| OAuth callback error | Verify `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and callback URL |
| No repos showing | Ensure the GitHub App has access to the repos you want |
| Private key errors | Re-generate and base64-encode the PEM file |
| Database connection failed | Check `DATABASE_URL` and ensure PostgreSQL is running |
