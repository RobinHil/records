// Limiteur de tentatives en mémoire, suffisant pour une instance unique
// (l'app tourne dans un seul conteneur). Il protège /api/auth/login du
// bourrinage : bcrypt ralentit chaque essai mais ne le bloque pas.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Purge paresseuse : évite que la Map grossisse indéfiniment sous une attaque
// distribuée qui présenterait une IP différente à chaque requête.
function sweep(now: number) {
  if (buckets.size < 10_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function hit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Après une connexion réussie, on repart de zéro pour ne pas pénaliser
// l'admin qui s'est trompé une ou deux fois.
export function reset(key: string) {
  buckets.delete(key);
}

// L'app est servie derrière un reverse proxy : l'IP réelle arrive dans
// X-Forwarded-For. L'en-tête est falsifiable, d'où le compteur global qui
// plafonne le total d'essais quelle que soit l'IP annoncée.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
