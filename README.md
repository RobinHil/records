# Records

A minimal, gallery-style web app for browsing a personal vinyl and CD collection.
The collection itself lives on [Discogs](https://www.discogs.com) - you add and
remove records there (site, app, barcode scan). This app synchronizes your
Discogs collection into its own SQLite database and layers on what Discogs does
not offer: a premium wall-of-records display, custom manual ordering, favorites,
and fast filtering.

Stack: Next.js (App Router, TypeScript), TailwindCSS, Framer Motion,
Prisma + SQLite, iron-session + bcrypt, react-virtuoso, dnd-kit, node-cron,
Docker + nginx. Package manager: pnpm.

## Prerequisites

- Node.js 22.12+ (24, the current LTS, is what the Docker image uses) and
  pnpm - or just Docker with Compose.
- A Discogs account holding your collection.

## 1. Get your Discogs credentials

1. **Username**: the name of the account that owns the collection (visible in
   your profile URL: `discogs.com/user/<username>`).
2. **Personal Access Token**: go to Discogs > Settings > Developers
   (<https://www.discogs.com/settings/developers>) and click
   **Generate new token**. This token lets the app read your collection even if
   it is private. Treat it like a password.

## 2. Configure the environment

```sh
cp .env.example .env
```

Fill in:

| Variable | Purpose |
| --- | --- |
| `DISCOGS_USERNAME` | Your Discogs username |
| `DISCOGS_TOKEN` | The personal access token from step 1 |
| `ADMIN_PASSWORD` | Initial admin password, hashed into the database on first launch |
| `SESSION_SECRET` | 32+ char secret for the session cookie (`openssl rand -base64 32`) |
| `SYNC_CRON` | Daily sync schedule, cron syntax (default `0 4 * * *`) |
| `DATABASE_URL` / `COVERS_DIR` | Leave the defaults; docker-compose overrides them to the persistent volume |

## 3a. Run with Docker (recommended)

```sh
docker compose up --build
```

Then open <http://localhost:8080>. That single command:

- builds and starts the Next.js app (`app` service),
- puts nginx in front as a reverse proxy (`nginx` service, port 8080),
- stores the SQLite file and cached covers in the `records-data` volume, so
  data survives rebuilds and redeployments,
- applies database migrations and creates the admin account on startup,
- schedules the daily Discogs sync inside the app process (node-cron, using
  `SYNC_CRON`).

## 3b. Run locally without Docker

```sh
pnpm install
pnpm prisma migrate dev   # creates prisma/dev.db
pnpm db:seed              # creates the admin user from ADMIN_PASSWORD
pnpm dev                  # http://localhost:3000
```

## 4. First login and first sync

1. Open `/admin` and sign in with `ADMIN_PASSWORD`.
2. Click **Sync now**. The first sync fetches every release plus its tracklist
   and cover, throttled to respect Discogs rate limits (60 req/min) - allow a
   few minutes for a ~200 record collection. Later syncs only fetch what
   changed and are much faster.

## How synchronization works

- **Automatic**: once a day (cron expression `SYNC_CRON`, default 04:00 server
  time), scheduled by node-cron inside the Next.js server process.
- **Manual**: the **Sync now** button in `/admin`, with progress indication and
  a per-run result (added / updated / archived / restored) plus a small history
  log.
- **Upsert logic**: every Discogs collection entry is created or updated by its
  `instance_id`. Owning the same album on CD and vinyl means two distinct
  Discogs entries, so both appear side by side in the wall.
- **Soft delete**: records that disappear from your Discogs collection are
  *archived*, not deleted - they vanish from the public gallery but keep their
  favorite flag and custom order, so re-adding them on Discogs restores them
  intact. Archived records are listed at the bottom of the admin view under
  "Missing from last sync".
- **Local-only fields**: favorites and custom order are never touched by a
  sync; only Discogs metadata is refreshed.
- Covers are downloaded once and cached locally (`COVERS_DIR`), so the gallery
  never hotlinks Discogs.

## Admin features

- **Sync now** with last-sync status and history.
- **Drag & drop** reordering of the whole collection ("My order" in the public
  sort menu).
- **Reset order** from an automatic sort (album, artist, or release year) as a
  starting point - asks for confirmation, then you refine by hand.
- **Favorites** toggle per record, usable as a public filter.

## Changing the admin password

```sh
ADMIN_PASSWORD="new-password" pnpm run reset-password
```

(Inside Docker: `docker compose exec app node /app/prisma/seed.js` will not
overwrite an existing user; use
`docker compose exec -e ADMIN_PASSWORD="new-password" app node /app/prisma/reset-password.js`.)

## Project structure

```
app/            App Router pages and API routes
  api/          records, sync, auth, covers, admin endpoints
  admin/        admin dashboard + login
components/     gallery/ (public UI) and admin/ UI
lib/            Prisma client, Discogs client, sync logic, session, queries
prisma/         schema, migrations, seed scripts
docker/         nginx config and container entrypoint
```
