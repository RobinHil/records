import type { NextConfig } from "next";

/*
 * Export statique.
 *
 * L'application n'a plus de serveur : `next build` rend l'unique page et le
 * fichier de collection dans out/, et un hebergeur de fichiers sert le tout.
 * Les en-tetes de securite que ce fichier posait sont partis avec lui - la
 * cle `headers()` ne fonctionne pas en export statique, et GitHub Pages ne
 * pose de toute facon aucun en-tete personnalise. Derriere un reverse proxy,
 * c'est a lui de les remettre.
 *
 * basePath : le site vit sous /records pour un site de projet GitHub Pages, a
 * la racine pour un domaine personnalise. Le workflow demande la valeur a
 * l'action configure-pages plutot que de l'ecrire en dur. Next prefixe de
 * lui-meme les liens <Link> et ses propres assets, mais pas un `fetch()` ni le
 * src d'une <img> ecrite a la main : voir lib/base-path.ts.
 */
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  // next dev recree sinon un AGENTS.md a la racine a chaque demarrage.
  agentRules: false,
  images: {
    // Il n'y a pas d'optimiseur d'images a l'execution sans serveur. Les
    // pochettes sont de toute facon rendues par une <img> simple, pour garder
    // la grille virtualisee legere.
    unoptimized: true,
  },
  env: {
    // Reexpose basePath au code client, qui en a besoin pour construire l'URL
    // du fichier de collection.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
