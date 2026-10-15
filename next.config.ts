import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Hosts que a landing aprovada usa (fonte Figtree e mídia do hero).
const LANDING_MEDIA = "https://d8j0ntlcm91z4.cloudfront.net";

// A landing tem CSS e JS inline, por isso 'unsafe-inline' em script e style.
// Em dev o Next precisa de 'unsafe-eval'; a CSP só vale em produção.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${LANDING_MEDIA}`,
  `media-src 'self' ${LANDING_MEDIA}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // A landing aprovada é servida byte a byte a partir de public/landing.html.
  // Ela não foi convertida para React para não mudar nada do que foi aprovado.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
