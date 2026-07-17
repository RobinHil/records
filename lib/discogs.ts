// Minimal Discogs API client with basic throttling.
// Discogs allows 60 requests/minute for authenticated requests; we stay under
// that by spacing calls at least 1.1s apart and backing off on 429.

const API_BASE = "https://api.discogs.com";
const USER_AGENT = "RecordsCollectionApp/1.0";
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttledFetch(url: string, attempt = 0): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const token = process.env.DISCOGS_TOKEN;
  if (!token) throw new Error("DISCOGS_TOKEN is not set");

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Discogs token=${token}`,
    },
    cache: "no-store",
  });

  if (res.status === 429 && attempt < 2) {
    await sleep(65_000);
    return throttledFetch(url, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Discogs API ${res.status} on ${url.split("?")[0]}`);
  }
  return res;
}

export interface DiscogsCollectionItem {
  instance_id: number;
  date_added: string;
  basic_information: {
    id: number;
    title: string;
    year: number;
    artists: { name: string; anv: string; join: string }[];
    labels: { name: string; catno: string }[];
    formats: { name: string; qty: string; descriptions?: string[] }[];
    genres?: string[];
    styles?: string[];
    cover_image?: string;
    thumb?: string;
  };
}

interface CollectionPage {
  pagination: { page: number; pages: number };
  releases: DiscogsCollectionItem[];
}

export async function fetchFullCollection(): Promise<DiscogsCollectionItem[]> {
  const username = process.env.DISCOGS_USERNAME;
  if (!username) throw new Error("DISCOGS_USERNAME is not set");

  const items: DiscogsCollectionItem[] = [];
  let page = 1;
  let pages = 1;
  do {
    const url =
      `${API_BASE}/users/${encodeURIComponent(username)}` +
      `/collection/folders/0/releases?page=${page}&per_page=100&sort=added&sort_order=desc`;
    const res = await throttledFetch(url);
    const data = (await res.json()) as CollectionPage;
    items.push(...data.releases);
    pages = data.pagination.pages;
    page += 1;
  } while (page <= pages);
  return items;
}

export interface DiscogsRelease {
  id: number;
  country?: string;
  uri?: string;
  tracklist?: { position: string; type_: string; title: string; duration: string }[];
  images?: { type: string; uri: string }[];
}

export async function fetchRelease(
  releaseId: number | bigint
): Promise<DiscogsRelease> {
  const res = await throttledFetch(`${API_BASE}/releases/${releaseId}`);
  return (await res.json()) as DiscogsRelease;
}

export async function fetchImage(url: string): Promise<ArrayBuffer> {
  const res = await throttledFetch(url);
  return res.arrayBuffer();
}

// "Miles Davis (2)" -> "Miles Davis": Discogs disambiguation suffixes are
// meaningless outside Discogs itself.
export function cleanArtistName(name: string): string {
  return name.replace(/\s+\(\d+\)$/, "").trim();
}

export function joinArtists(
  artists: { name: string; anv: string; join: string }[]
): string {
  let out = "";
  artists.forEach((a, i) => {
    out += cleanArtistName(a.anv || a.name);
    if (i < artists.length - 1) {
      const j = (a.join || "&").trim();
      out += j === "," ? ", " : ` ${j} `;
    }
  });
  return out.trim();
}

export function sortableArtist(artist: string): string {
  return artist.replace(/^(the|les|le|la)\s+/i, "").toLowerCase();
}

export function detectFormat(
  formats: { name: string }[]
): "VINYL" | "CD" | "OTHER" {
  const names = formats.map((f) => f.name.toLowerCase());
  if (names.some((n) => n.includes("vinyl") || n === "lp")) return "VINYL";
  if (names.some((n) => n.includes("cd"))) return "CD";
  return "OTHER";
}

export function releaseUrl(releaseId: number | bigint): string {
  return `https://www.discogs.com/release/${releaseId}`;
}
