import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isAdmin?: boolean;
}

const SIXTY_DAYS = 60 * 60 * 24 * 60;
const DEV_SECRET = "insecure-dev-only-secret-change-me-in-env-file";

// iron-session exige au moins 32 caractères pour dériver la clé de chiffrement.
const MIN_SECRET_LENGTH = 32;

function isProduction(): boolean {
  // Pendant `next build`, les routes sont importées sans que les secrets de
  // production soient forcément présents : on ne bloque qu'à l'exécution.
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (isProduction()) {
    // Sans ce garde, un déploiement où SESSION_SECRET est oublié tournerait avec
    // un secret public : n'importe qui pourrait forger un cookie admin valide.
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET manquant ou trop court (${MIN_SECRET_LENGTH} caractères minimum). ` +
          "Générez-en un avec : openssl rand -base64 32"
      );
    }
    return secret;
  }

  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : DEV_SECRET;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: resolveSecret(),
    cookieName: "records_session",
    ttl: SIXTY_DAYS,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      // En production le cookie est Secure par défaut ; SESSION_SECURE="false"
      // permet de le désactiver explicitement (reverse proxy en clair, test…).
      // Une valeur vide compte comme non définie (cas d'un .env avec la clé
      // présente mais sans valeur).
      secure: process.env.SESSION_SECURE
        ? process.env.SESSION_SECURE === "true"
        : process.env.NODE_ENV === "production",
      maxAge: SIXTY_DAYS,
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function requireAdmin(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}
