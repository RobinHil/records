# Records

A minimal, gallery-style web app for browsing a personal vinyl and CD collection.
The collection itself lives on [Discogs](https://www.discogs.com) - you add and
remove records there (site, app, barcode scan). This app synchronizes your
Discogs collection and layers on what Discogs does not offer: a premium
wall-of-records display, custom manual ordering, favorites, and fast filtering.

The site is **fully static**. The build synchronizes the collection, writes it
to a single `collection.json`, and the browser does the searching, filtering and
sorting. Nothing runs in production: no database, no session, no API.

Stack: Next.js (App Router, TypeScript, static export), TailwindCSS, Framer
Motion, react-virtuoso. No database. Package manager: pnpm.

## Prerequisites

- Node.js 24 (see `.nvmrc`) and pnpm.
- A Discogs account holding your collection.

## 1. Get your Discogs credentials

1. **Username**: the name of the account that owns the collection (visible in
   your profile URL: `discogs.com/user/<username>`).
2. **Personal Access Token**: go to Discogs > Settings > Developers
   (<https://www.discogs.com/settings/developers>) and click
   **Generate new token**. This token lets the app read your collection even if
   it is private. Treat it like a password.

For the deployed site, both go in the repository secrets, as `DISCOGS_TOKEN`
and `DISCOGS_USERNAME`. Nothing else is needed: the workflow asks GitHub Pages
for the address the site will be served under.

## 2. Build it locally

```bash
cp .env.example .env     # then fill DISCOGS_USERNAME and DISCOGS_TOKEN
pnpm install
pnpm sync                # updates data/collection.json, downloads covers
pnpm dev                 # http://localhost:3000
```

`pnpm build` produces the static site in `out/`. It reads
`data/collection.json` and calls nothing: only `pnpm sync` talks to Discogs.

## How synchronization works

The state of the collection lives in `data/collection.json`, **committed to the
repository**. `pnpm sync` brings it up to date with Discogs:

1. Fetches the full Discogs collection, one request per 100 records.
2. Inserts new records, refreshes the Discogs fields of existing ones, and
   **soft-deletes** records that disappeared - they are kept with an
   `archivedAt` date, not erased, so favorites and manual order survive an
   accidental removal and re-add.
3. Fetches the tracklist and country **only for records that never got them**.
4. Downloads **only the covers that are missing** from `public/covers/`.

That file is what makes the nightly run cheap. Discogs calls are spaced 1.1
seconds apart to stay under its rate limit, so re-fetching every tracklist and
every cover each night would take roughly 2.2 seconds per record - tens of
minutes, for data that has not changed. With the state committed, a night where
nothing was added costs exactly one request.

The covers are not committed: a whole collection of JPEGs has no business
growing the repository. The workflow caches them between runs and re-downloads
what the cache lost, which is why `sync` checks that the file is actually on
disk and not merely named in the state.

## Favorites and manual order

Discogs knows neither. They are fields of each record in
`data/collection.json`, edited by hand, and every synchronization preserves
them - `sync` only ever overwrites the fields that come from Discogs.

```json
{
  "instanceId": 1234567890,
  "title": "Kind of Blue",
  "isFavorite": true,
  "customOrder": 1
}
```

`customOrder` sorts ascending under the "My order" sort; records without one
come after those that have one.

To carry over the favorites and ordering from the old server deployment, read
them out of its SQLite database and paste them into the matching records:

```bash
sqlite3 records.db "
  SELECT instanceId, isFavorite, customOrder
  FROM Record
  WHERE isFavorite = 1 OR customOrder IS NOT NULL
  ORDER BY customOrder;
"
```

## Deployment

[.github/workflows/pages.yml](.github/workflows/pages.yml) builds and publishes
to GitHub Pages. Pages must be set to "GitHub Actions" in Settings > Pages,
and `DISCOGS_TOKEN` and `DISCOGS_USERNAME` must exist as repository secrets.

Who syncs, and when:

- **A push to `main`** rebuilds from the committed state and calls nothing.
  Publishing a fix should not depend on Discogs, and a pull request has no
  business touching the secrets.
- **The daily run**, at 04:00 UTC - the hour the server's cron used to run -
  synchronizes, commits `data/collection.json` back if it changed, and
  republishes. The commit is made with `GITHUB_TOKEN`, which by design does not
  trigger another run, so there is no loop.
- **A manual run** synchronizes only if you tick the box.
- As a bootstrap, a sync also happens whenever the state file is still empty,
  so the very first deployment does not publish an empty gallery.

## What the move to static removed

The app had an admin back-office: a password login, a favorites toggle, manual
drag-and-drop ordering, and a button to trigger a sync. A static host executes
nothing, so there is no server to hold a session or accept a write, and an
editing interface would have had nothing to write to.

The public gallery never wrote anything, so it lost no feature: favorites and
manual order are still displayed and still filterable. What changed is how they
are edited - by hand in `data/collection.json` instead of by dragging tiles.

Prisma and SQLite went with it. The database had become a file that only the
build read, once; the state it used to hold is now the versioned JSON, which a
human can read and a diff can show.

Also gone with the server: the security headers `next.config.ts` used to set.
GitHub Pages sets no custom headers. Behind a reverse proxy, that proxy has to
put them back.

## Project structure

```
app/
  page.tsx                  the gallery page
  collection.json/route.ts  force-static handler: writes out/collection.json
components/gallery/
  filtering.ts              search, filters and sorts, in the browser
  Gallery.tsx               loads collection.json, renders the virtualized grid
lib/
  discogs.ts                Discogs API client
  library.ts                reads and writes data/collection.json
  sync.ts                   the synchronization itself
  records.ts                turns the state into what the site publishes
  base-path.ts              deployment sub-path, for the URLs the code builds
scripts/sync.ts             pnpm sync
data/collection.json        the state: collection, favorites, manual order
```
