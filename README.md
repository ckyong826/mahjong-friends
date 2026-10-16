# Mahjong Friends · 好友麻将

A private, four-player browser Mahjong project: flowers/seasons, optional animal tiles, blank **Fei** joker, seat-specific face-up discard rivers, private invite rooms, and WebSocket game actions.

> **Development beta, not yet production deployed.** Source and CI exist in this private GitHub repository; four real people can use the same room after a running Worker is provisioned. Exact Malaysian/Singaporean Fei house rules and official scoring are **not implemented**. The current virtual points are clearly marked Practice v1.

## Features

- Four players join with six-character invite code and separate private reconnect credentials.
- **Solo practice:** a room owner can click **🤖 补满练习机器人** to fill all empty seats with server-controlled beginner bots, then ready up and play alone. Bots automatically act and resolve legal claims on a durable Cloudflare alarm. Before starting a hand, joining human friends replace bots automatically.
- Configurable four-player tile inventory with flowers, animals, optional Fei.
- Server validates legal draw, discard, Chow, Pong, Kong, Hu, pass; prevents cheating and duplicate messages.
- Cloudflare Durable Object persistence and hibernatable WebSocket sync.
- Mobile/desktop clickable Mahjong table, four separate rivers, bonus and exposed meld areas.
- Virtual-points **practice** scoring, cumulative totals, and next-round readiness/dealer rotation.

## Stack

React, TypeScript, Vite, Cloudflare Workers + SQLite-backed Durable Objects, WebSockets, Vitest and Playwright Chromium.

## Local dev

Node.js 22+ and npm 11:

```bash
npm install
npm run dev
```

- Vite serves frontend and Worker/DO emulator.
- Try `GET /api/health`.
- Open four independent browser profiles for true separate player identities.

## Quality gates

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs typecheck, Vitest, Cloudflare bundle build, and a full Playwright **four-browser** room and game simulation.

## Deploying to your own Cloudflare

1. In Cloudflare, locate your **Account ID**.
2. In Cloudflare Account API Tokens, create a restricted token with Workers Edit permission for only your account.
3. In [this private repository's Actions secrets](https://github.com/ckyong826/mahjong-friends/settings/secrets/actions), create `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. **Do not paste the token in ChatGPT or commit it to the repo.**
4. From [GitHub Actions](https://github.com/ckyong826/mahjong-friends/actions/workflows/deploy.yml), choose **Run workflow**. Later successful CI runs on `main` trigger the deployment workflow automatically.

See [deployment details](docs/DEPLOYMENT.md) for smoke tests, migration and cloud setup checks. This has **not** been deployed or remotely validated yet; do not treat the CI bundle build alone as live availability.

## Rules

- [Product specification](docs/SPEC.md)
- [Gameplay reducer](docs/GAME_ENGINE.md)
- [WebSocket security](docs/WEBSOCKET_PROTOCOL.md)
- [Interactive tabletop](docs/TABLE_UI.md)
- [Scoring Practice v1 and missing house rules](docs/SCORING_PRACTICE.md)
- [Development Issues](https://github.com/ckyong826/mahjong-friends/issues)
