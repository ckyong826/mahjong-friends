# Mahjong Friends

A private browser-based Mahjong project with flowers, optional animal tiles, **blank Fei jokers**, distinct discard rivers for every seat, and invite-only multiplayer rooms.

> **Status: scaffold only.** The home screen and health endpoint are implemented. Creating rooms, actual gameplay, and public deployment are not available yet.

## Stack

- React 19 + TypeScript + Vite
- Cloudflare Workers with the official Vite plugin
- Durable Objects + WebSockets will be implemented in [Issues #4–#5](https://github.com/ckyong826/mahjong-friends/issues)
- Vitest and GitHub Actions CI

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Visit the URL printed by Vite. The SPA calls `GET /api/health`.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Cloudflare

The Worker and static app share one Cloudflare Workers deployment. It is configured in `wrangler.jsonc`.

After connecting your Cloudflare account and verifying the build:

```bash
npx wrangler login
npm run deploy
```

You can later configure Cloudflare Builds to connect this **private** GitHub repository for automatic main-branch builds. Do not store tokens or secrets in Git.

## Rules and roadmap

- [Product and engineering specification](docs/SPEC.md)
- [Development issues](https://github.com/ckyong826/mahjong-friends/issues)
- New play modes are enabled only after precise scoring and Fei rules are documented and tested.
