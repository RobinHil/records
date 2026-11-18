"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import type { Collection } from "@/lib/types";

/*
 * Le fichier de collection produit au build, charge une fois par page.
 *
 * `collection` reste null tant qu'il n'est pas arrive ; `failed` passe a vrai
 * si la requete echoue, et la page n'a alors rien a afficher.
 */
export function useCollection(): { collection: Collection | null; failed: boolean } {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(withBasePath("/collection.json"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Collection>;
      })
      .then((data) => {
        if (!cancelled) setCollection(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { collection, failed };
}
