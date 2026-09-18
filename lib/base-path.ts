/*
 * Chemin de base du deploiement, cote client.
 *
 * Next prefixe automatiquement les <Link> et ses propres assets, mais pas ce
 * que le code construit lui-meme : l'URL passee a fetch() et le src des
 * pochettes. `basePath` de next.config.ts n'est pas lisible a l'execution,
 * d'ou cette variable, que la config reexpose sous NEXT_PUBLIC_BASE_PATH.
 *
 * Vaut "" quand le site est servi a la racine d'un domaine.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
