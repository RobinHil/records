# Records

Live at <https://robinhil.github.io/records/>

A minimal, gallery-style web app for browsing a personal vinyl and CD collection.
The collection itself lives on [Discogs](https://www.discogs.com) - you add and
remove records there (site, app, barcode scan). This app synchronizes your
Discogs collection and layers on what Discogs does not offer: a premium
wall-of-records display, fast filtering, and a printable poster of the
collection's covers sorted by color.

The site is **fully static**. A synchronization brings `data/collection.json`
up to date with Discogs, the build publishes it as a single `collection.json`,
and the browser does the rest: searching, filtering and sorting the gallery,
reading the cover colors for the poster. Nothing runs in production: no
database, no session, no API.

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
   `archivedAt` date, not erased, so an accidental removal and re-add does not
   cost another round of Discogs calls.
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

## Poster

`/poster` lays the covers of the collection out as a mosaic sorted by
dominant color, sized for print: A4, A3, A2, A1, 50 x 70 cm or 24 x 36 in,
portrait or landscape, with margin, gap, background and an optional caption
set above, below, across the middle or framed by the covers.

What goes into it is chosen in three steps: color families (white, red,
orange, yellow, green, blue, pink, black, any combination), covers left out
with their hide button, and optionally a random draw of a given number of
covers.

Then comes the arrangement. "By color" keeps the gradient, and Shuffle covers
swaps covers of neighbouring hues, so places change everywhere while the
gradient survives; "Random" drops the gradient. When the number of covers is
limited, Shuffle covers also draws a new set. Shuffle shapes moves the
large covers elsewhere on the grid. On top of that, every spot can be edited
by hand: drag a cover onto another to swap them (each keeps the size of the
spot it lands in), or use a cover's replace button to pick any cover of the
collection for that spot. These edits name covers, not spots, so they survive
a change of paper or margin; Reset undoes them.

The grid is chosen to fit the paper. With "Fill the page", it fills the
printable area and a few covers take four cells to absorb what would
otherwise be left blank; with "All the same", every cover has the same size
and the grid is centered, leaving margins where the count does not divide
evenly.

The settings, the covers left out and the manual edits are kept in the
browser's local storage: a poster worked on over several visits stays as it
was left, on that browser.

The covers it uses are the ones `pnpm sync` already downloaded from Discogs
into `public/covers/`: served by the site itself, they can be read pixel by
pixel in a canvas, which a Discogs URL does not allow (Discogs sends no CORS
header). A record whose cover is missing is left out, and the page says how
many.

The dominant color is computed in the browser, in OKLab: each cover is shrunk
to 40 x 40 pixels, every pixel is binned by hue and lightness (or by lightness
alone for greys), and the fullest bin wins, colorful pixels weighing slightly
more so that a white or black background does not win every time. The poster
then runs from whites and light greys, through the hues from red to magenta,
to dark greys and black, along rows, columns or a diagonal.

Two outputs:

- **Print or save as PDF** opens the browser's print dialog with the page set
  to the poster's size. Pick that paper size and turn headers and footers off.
- **Download JPEG** renders the poster at 300 dpi, lowered on the largest
  formats to stay within what browsers allow a canvas, and records that
  resolution in the file.

Discogs covers are at most 600 pixels wide, so past a few centimeters per cover
they set the sharpness, not the output. The page shows the resolution the
smallest cover will print at and warns below 150 dpi.

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

Favorites and the manual order did not survive: with the toggle and the
drag-and-drop gone nothing set them any more, so the fields, the gallery
filter and the "My order" sort that read them were removed as well.

Prisma and SQLite went with the back-office. The database had become a file
that only the build read, once; the state it used to hold is now the versioned
JSON, which a human can read and a diff can show.

Also gone with the server: the security headers `next.config.ts` used to set.
GitHub Pages sets no custom headers. Behind a reverse proxy, that proxy has to
put them back.

## Project structure

```
app/
  page.tsx                  the gallery page
  poster/page.tsx           the poster page
  collection.json/route.ts  force-static handler: writes out/collection.json
components/gallery/
  filtering.ts              search, filters and sorts, in the browser
  Gallery.tsx               loads collection.json, renders the virtualized grid
components/poster/
  Poster.tsx                reads the covers, selection, preview, print
  CoverPicker.tsx           the dialog that picks the cover of a spot
  controls.tsx              the settings panel's inputs
  settings.ts               settings, kept in local storage
  color.ts                  dominant color, color order and families
  layout.ts                 paper sizes and grid, in millimeters
  export.ts                 the poster rendered as a print-resolution JPEG
lib/
  discogs.ts                Discogs API client
  covers.ts                 downloads covers into public/covers
  library.ts                reads and writes data/collection.json
  sync.ts                   the synchronization itself
  records.ts                turns the state into what the site publishes
  types.ts                  what the site publishes, and the gallery's filters
  base-path.ts              deployment sub-path, for the URLs the code builds
  use-collection.ts         loads collection.json in the browser
scripts/sync.ts             pnpm sync
data/collection.json        the state of the collection
```
