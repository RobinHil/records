import { FAMILIES, type Family } from "@/components/poster/color";
import {
  PAPERS,
  type CaptionPosition,
  type Flow,
  type Orientation,
  type Sizing,
} from "@/components/poster/layout";
import type { FormatFilter } from "@/lib/types";

/*
 * Les reglages de l'affiche, gardes dans le navigateur.
 *
 * Une affiche se peaufine en plusieurs fois : les pochettes masquees et les
 * choix de mise en page doivent survivre a un rechargement. Ils restent dans
 * le localStorage de ce navigateur, faute de serveur ou les ecrire, et tout
 * ce qui en sort est verifie : une valeur absente ou d'une ancienne version
 * reprend sa valeur par defaut au lieu de casser la page.
 */

export type Background = "white" | "black";

/** Ordre des pochettes : le degrade de couleurs, ou le hasard. */
export type Order = "color" | "random";

export interface PosterSettings {
  paperId: string;
  orientation: Orientation;
  flow: Flow;
  sizing: Sizing;
  background: Background;
  margin: number;
  gap: number;
  caption: string;
  captionPosition: CaptionPosition;
  format: FormatFilter;
  /** Familles retenues ; vide, toutes le sont. */
  families: Family[];
  /** instanceId des pochettes retirees a la main. */
  hidden: number[];
  /** Nombre de pochettes tirees au sort ; null, toutes. */
  limit: number | null;
  order: Order;
  /**
   * Graine du melange, changee par "Shuffle covers" : elle decide du tirage
   * et des places. 0, l'ordre exact des couleurs.
   */
  seed: number;
  /** Graine de la forme de la mosaique, changee par "Shuffle shapes". */
  shapeSeed: number;
  /**
   * Retouches a la main, rejouees dans l'ordre : [a, b] met la pochette b a
   * la place de a. Si b est deja sur l'affiche, les deux echangent leur
   * place ; sinon b entre et a sort.
   *
   * La liste n'est jamais tronquee : chaque retouche depend de celles qui la
   * precedent, et oublier les plus anciennes changerait l'affiche sans
   * prevenir. "Reset" la vide.
   */
  edits: [number, number][];
}

export const DEFAULT_SETTINGS: PosterSettings = {
  paperId: "a2",
  orientation: "portrait",
  flow: "rows",
  sizing: "mixed",
  background: "white",
  margin: 20,
  gap: 2,
  caption: "",
  captionPosition: "bottom",
  format: "both",
  families: [],
  hidden: [],
  limit: null,
  order: "color",
  seed: 0,
  shapeSeed: 0,
  edits: [],
};

const STORAGE_KEY = "records:poster";

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function loadSettings(): PosterSettings {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
  const d = DEFAULT_SETTINGS;
  const familyIds = FAMILIES.map((f) => f.id);
  return {
    paperId: oneOf(raw.paperId, PAPERS.map((p) => p.id), d.paperId),
    orientation: oneOf(raw.orientation, ["portrait", "landscape"] as const, d.orientation),
    flow: oneOf(raw.flow, ["rows", "columns", "diagonal"] as const, d.flow),
    sizing: oneOf(raw.sizing, ["uniform", "mixed"] as const, d.sizing),
    background: oneOf(raw.background, ["white", "black"] as const, d.background),
    margin: finite(raw.margin, d.margin, 0, 40),
    gap: finite(raw.gap, d.gap, 0, 10),
    caption: typeof raw.caption === "string" ? raw.caption.slice(0, 60) : d.caption,
    captionPosition: oneOf(
      raw.captionPosition,
      ["top", "bottom", "band", "framed"] as const,
      d.captionPosition
    ),
    format: oneOf(raw.format, ["vinyl", "cd", "both"] as const, d.format),
    families: Array.isArray(raw.families)
      ? raw.families.filter((f): f is Family => familyIds.includes(f))
      : d.families,
    hidden: Array.isArray(raw.hidden)
      ? raw.hidden.filter((id): id is number => Number.isInteger(id))
      : d.hidden,
    limit: raw.limit === null ? null : finite(raw.limit, 0, 1, 10_000) || null,
    order: oneOf(raw.order, ["color", "random"] as const, d.order),
    seed: finite(raw.seed, d.seed, 0, 2 ** 31),
    shapeSeed: finite(raw.shapeSeed, d.shapeSeed, 0, 2 ** 31),
    edits: Array.isArray(raw.edits)
      ? raw.edits
          .filter(
            (e): e is [number, number] =>
              Array.isArray(e) && e.length === 2 && e.every((id) => Number.isInteger(id))
          )
      : d.edits,
  };
}

export function saveSettings(settings: PosterSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Stockage plein ou interdit (navigation privee) : les reglages ne
    // seront simplement pas retenus.
  }
}

/*
 * Les reglages comme source externe, lue par useSyncExternalStore : pendant
 * l'hydratation React prend les valeurs par defaut, celles du prerendu, puis
 * passe d'elles-memes a celles du navigateur.
 */
let current: PosterSettings | null = null;
const listeners = new Set<() => void>();

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSettings(): PosterSettings {
  current ??= loadSettings();
  return current;
}

export function getDefaultSettings(): PosterSettings {
  return DEFAULT_SETTINGS;
}

export function updateSettings(patch: Partial<PosterSettings>): void {
  current = { ...getSettings(), ...patch };
  saveSettings(current);
  for (const listener of listeners) listener();
}
