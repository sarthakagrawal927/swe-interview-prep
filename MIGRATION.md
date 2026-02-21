# Migration from Supabase to Google OAuth + TursoDB

This document outlines the migration from Supabase to Google OAuth authentication and TursoDB database.

## What Changed

### Authentication
- **Before**: Supabase OAuth with Google (redirect flow)
- **After**: Google One Tap with JWT tokens (no redirect)

### Database
- **Before**: Supabase PostgreSQL
- **After**: TursoDB (libSQL/SQLite)

### Backend
- **Before**: Direct Supabase client calls from frontend
- **After**: Vercel serverless functions with API endpoints

## Database Schema

TursoDB tables matching Supabase structure:

### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### `user_chats`
```sql
CREATE TABLE user_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  messages TEXT NOT NULL,  -- JSON array
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, problem_id)
)
```

### `user_notes`
```sql
CREATE TABLE user_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  notes TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, problem_id)
)
```

### `user_imported_problems`
```sql
CREATE TABLE user_imported_problems (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  problem_data TEXT NOT NULL,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, problem_id)
)
```

## API Endpoints

### Authentication
- `POST /api/auth/google` - Verify Google credential, return JWT + user
- `GET /api/auth/verify` - Verify JWT token

### Data Operations
- `GET /api/chats?problemId={id}` - Get chat history
- `POST /api/chats` - Save chat history
- `DELETE /api/chats?problemId={id}` - Clear chat history
- `GET /api/notes?problemId={id}` - Get notes
- `POST /api/notes` - Save notes
- `GET /api/problems` - Get imported problems
- `POST /api/problems` - Add/update imported problem

All data endpoints require `Authorization: Bearer <token>` header.

## Environment Variables

### Required
```bash
GOOGLE_CLIENT_ID=           # Google OAuth client ID (backend)
VITE_GOOGLE_CLIENT_ID=      # Google OAuth client ID (frontend)
TURSO_DATABASE_URL=         # TursoDB connection URL
TURSO_AUTH_TOKEN=           # TursoDB auth token
JWT_SECRET=                 # Secret for JWT signing (use strong random string)
```

### Setup Steps

1. **Google OAuth Setup**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select project
   - Enable Google+ API
   - Create OAuth 2.0 Client ID
   - Add authorized JavaScript origins:
     - `http://localhost:5173` (dev)
     - `https://your-domain.vercel.app` (prod)
   - Copy client ID to both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`

2. **TursoDB Setup**
   - Install Turso CLI: `brew install tursodb/tap/turso` (macOS) or `curl -sSfL https://get.tur.so/install.sh | bash`
   - Login: `turso auth login`
   - Create database: `turso db create swe-interview-prep`
   - Get URL: `turso db show swe-interview-prep --url`
   - Create token: `turso db tokens create swe-interview-prep`
   - Add to env vars

3. **JWT Secret**
   - Generate random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Add to `JWT_SECRET`

4. **Vercel Setup**
   - Add all environment variables in Vercel project settings
   - Redeploy after adding env vars

## Guest Mode

Guest mode still works with localStorage fallback:
- AI chat history: `localStorage.getItem('dsa-prep-chats')`
- Notes: `localStorage.getItem('dsa-prep-notes')`
- No backend calls when not authenticated

## Migration Checklist

- [x] Backend API endpoints created
- [x] Database schema defined
- [x] Auth flow implemented (Google One Tap)
- [x] Frontend hooks updated
- [x] Dependencies updated
- [ ] Environment variables configured
- [ ] TursoDB database created
- [ ] Google OAuth credentials obtained
- [ ] Vercel env vars updated
- [ ] Test locally
- [ ] Deploy to production
- [ ] Verify auth flow works
- [ ] Verify data persistence works
- [ ] Remove old Supabase dependencies
- [ ] Remove old `.old.ts` backup files

## Rollback Plan

If issues arise:
1. Revert files: `mv src/**/*.old.ts` back to original names
2. Restore Supabase in package.json
3. Run `npm install`
4. Restore Supabase env vars in Vercel
