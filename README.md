# 🔄 Git Recovery

Backdate your GitHub contribution graph with precision. Create commits on any past dates with configurable intensity, AI-generated messages, and a visual art mode to design your contribution graph.

## ✨ Features

- **🔐 GitHub App Auth** — Secure OAuth login, no personal access tokens needed
- **📅 Date Range / Custom Dates** — Pick exactly which days to fill
- **⚡ Fixed / 🎲 Random / 🎨 Art Mode** — Control commit intensity per day
- **🎨 Art Mode** — Paint your contribution grid, upload images, or type text
- **🤖 AI Commit Messages** — Natural-looking messages via any OpenAI-compatible API
- **📋 Pull Request Mode** — Creates changes on a branch with a PR for review
- **📊 Job History** — Track all your backdate jobs with real-time logs

## 🚀 Quick Setup

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** database
- **GitHub App** ([create one](https://github.com/settings/apps/new))

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/git-recovery.git
cd git-recovery
npm install
```

### 2. Create GitHub App

1. Go to [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Set **Homepage URL** to your app URL
3. Set **Callback URL** to `https://your-domain.com/api/auth/callback`
4. **Permissions needed:**
   - Repository contents: Read & Write
   - Pull requests: Read & Write
5. Generate a **private key** and download the `.pem` file
6. Note your **App ID**, **Client ID**, and **Client Secret**

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your GitHub App credentials
```

**Private key options:**
- **Local dev:** Set `GITHUB_APP_PRIVATE_KEY_PATH=your-app.private-key.pem`
- **Production:** Base64-encode it: `cat your-key.pem | base64 -w 0` → set `GITHUB_APP_PRIVATE_KEY`

### 4. Setup Database

```bash
npx prisma migrate dev
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_APP_ID` | ✅ | GitHub App ID |
| `GITHUB_CLIENT_ID` | ✅ | OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | OAuth Client Secret |
| `GITHUB_APP_PRIVATE_KEY` | ✅* | Base64-encoded PEM key |
| `GITHUB_APP_PRIVATE_KEY_PATH` | ✅* | Path to PEM file (alt) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Random 32+ char string |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Your app's public URL |
| `AI_BASE_URL` | ❌ | OpenAI-compatible API URL |
| `AI_API_KEY` | ❌ | API key for AI messages |

\* Use one of `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_PATH`

## 🛠️ Tech Stack

- **Next.js 15** (App Router)
- **Prisma** + PostgreSQL
- **GitHub App** (Octokit)
- **iron-session** for auth
- **simple-git** for git operations

## 📄 License

MIT
