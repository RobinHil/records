import type { NextConfig } from "next";

// En-têtes de sécurité posés par l'application elle-même.
//
// Ils vivaient auparavant dans docker/nginx.conf, qui ne sert qu'au
// docker-compose de développement : en production c'est Caddy qui est devant,
// et son Caddyfile ne pose ces en-têtes que pour les sites statiques. records
// était donc servi sans X-Frame-Options ni CSP, et son /admin encadrable en
// iframe malgré une session de 60 jours.
//
// Les poser ici les rend indépendants du proxy du moment.
//
// Pas de script-src ni de style-src : Next injecte des scripts inline pour
// l'hydratation, une CSP stricte demanderait une nonce par requête. Les quatre
// directives ci-dessous, elles, n'ont aucun effet de bord sur Next.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // next dev recree sinon un AGENTS.md a la racine a chaque demarrage.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
