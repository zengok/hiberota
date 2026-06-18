# Hibe Rota Security

Hibe Rota is a public, no-login grant portal. Public read APIs remain open, while operational write endpoints require an admin bearer token.

## Required Production Secrets

- `ADMIN_API_TOKEN`: required in production for admin actions.

Admin requests must send:

```http
Authorization: Bearer <ADMIN_API_TOKEN>
```

Query-string tokens such as `?api_key=` are intentionally rejected because URLs are commonly logged by proxies, browsers, and monitoring tools.

## Active Protections

- Security headers through Helmet, including CSP, HSTS in production, frame denial, referrer policy, and restrictive browser permissions.
- API rate limiting for public APIs, stricter limits for admin refresh/manual-review actions, export downloads, and match requests.
- Production startup fails when admin authentication is not configured.
- Constant-time admin token comparison.
- JSON body size limits on POST endpoints.
- URL length and query value validation.
- Request IDs on responses and sanitized access logging.
- SSE client cap to protect server resources.
- Static assets served with immutable caching while `index.html` remains no-cache.
- `npm audit --omit=dev` is part of `npm run check`.
