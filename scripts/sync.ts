/*
 * Synchronisation Discogs, en ligne de commande.
 *
 * Elle tournait dans le processus du serveur, declenchee chaque nuit par
 * node-cron et a la demande depuis le back-office. Il n'y a plus de serveur :
 * c'est le workflow de deploiement qui l'appelle, ou toi en local.
 *
 * Elle met a jour data/collection.json, versionne, et telecharge dans
 * public/covers les pochettes qui manquent. Les deux sortent modifies : le
 * fichier d'etat est a committer, les pochettes non.
 *
 * Usage : pnpm sync
 */
import { runSync } from "@/lib/sync";
import { LIBRARY_PATH, readLibrary } from "@/lib/library";

async function main(): Promise<void> {
  const before = await readLibrary();
  const result = await runSync();

  console.log(
    `[sync] ${result.total} disques sur Discogs : ${result.added} ajoutes, `
      + `${result.updated} mis a jour, ${result.archived} archives, `
      + `${result.restored} restaures`
  );
  console.log(
    `[sync] appels detail : ${result.details}, pochettes telechargees : ${result.covers}`
  );

  const after = await readLibrary();
  const live = after.records.filter((r) => r.archivedAt === null).length;
  console.log(`[sync] collection vivante : ${live} disques (${LIBRARY_PATH})`);

  // Une collection vide veut dire que Discogs n'a rien renvoye : mieux vaut
  // s'arreter que publier un site vide en ecrasant un etat qui etait bon.
  if (live === 0) {
    throw new Error(
      before.records.length > 0
        ? "Discogs n'a renvoye aucun disque alors que l'etat precedent n'etait pas vide."
        : "La collection est vide : rien a publier."
    );
  }
}

main().catch((e) => {
  console.error("[sync] echec :", e);
  process.exitCode = 1;
});
