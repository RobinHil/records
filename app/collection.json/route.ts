import { loadCollection } from "@/lib/records";

/*
 * La collection, servie comme un fichier.
 *
 * `force-static` est ce qui rend ce gestionnaire compatible avec l'export
 * statique : Next l'execute une fois pendant `next build` et ecrit sa reponse
 * dans out/collection.json. Rien ne l'execute ensuite, il n'y a pas de
 * serveur - il ne peut donc rien lire de la requete, ce qui tombe bien : il
 * renvoie toujours la meme chose.
 *
 * C'est aussi le seul endroit du build qui touche a la base. Celle-ci n'est
 * plus un stockage mais un artefact : le workflow la cree a partir des
 * migrations, la remplit depuis Discogs, y applique les annotations du depot,
 * et elle disparait avec le runner.
 */
export const dynamic = "force-static";

export async function GET() {
  const collection = await loadCollection(process.env.BASE_PATH || "");
  return Response.json(collection);
}
