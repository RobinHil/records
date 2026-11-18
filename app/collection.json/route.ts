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
 * C'est aussi le seul endroit du build qui lit l'etat de la collection,
 * data/collection.json, et il n'appelle rien : seule la synchronisation parle
 * a Discogs.
 */
export const dynamic = "force-static";

export async function GET() {
  const collection = await loadCollection(process.env.BASE_PATH || "");
  return Response.json(collection);
}
