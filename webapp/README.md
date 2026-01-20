# YouTube Subscriptions Migrator (Web App)

## Prereqs
- Node.js
- Prisma CLI installed (already in dev deps)
- Google Cloud project with YouTube Data API enabled

## Environment
Create `.env` (copy from `env.example`) and edit it:
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (default: http://localhost:3000/oauth2callback)

## Google OAuth setup (Web application)
1) Open Google Cloud Console.
2) APIs & Services -> Credentials -> Create Credentials -> OAuth client ID.
3) Application type: Web application.
4) Authorized redirect URIs:
   - http://localhost:3000/oauth2callback
5) Copy Client ID and Client Secret to `.env`.

## Run
```
npm run start
```
Open http://localhost:3000

## Notes
- CSV must include channel ID or channel URL containing `/channel/UC...`.
- Handle URLs (`/@handle`) are not resolved.
- The app processes entries sequentially with a configurable delay.
