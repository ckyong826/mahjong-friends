# Cloudflare deployment and live validation

This project is **not deployed automatically until the owner provides credentials as GitHub Actions secrets**. Do not paste API tokens into chats or repository files. Deployment does not require making the GitHub repository public.

## Before configuring secrets

- Decide on the Cloudflare account where the Worker will run.
- Cloudflare Dashboard > Account ID. Copy the non-secret ID.
- Account API Tokens > Create Token > Edit Cloudflare Workers permissions. Scope to that account only.
- GitHub private repository > Settings > Secrets and variables > Actions > New repository secret.
- Add exactly `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Never add them to `.env` or git.
- Ensure the Cloudflare account supports SQLite-backed Durable Objects. First deployment must create the DO binding as configured in `wrangler.jsonc`.
- The production script builds Vite and runs Wrangler deploy; no other database or long-lived VM is required.

## CI and deploy gate

CI on each PR: TypeScript strict check, Vitest, Worker bundle build and Chromium Playwright test on four **separate browser contexts**. E2E covers anonymous invite, four seats, readiness, starting the hand, real UI discard and four personalized discard rivers, full round using WebSocket actions, settlement and next round. Chromium screenshots of desktop/mobile and traces are retained if tests fail.

Deployment workflow `.github/workflows/deploy.yml` runs only for **successful CI on main** or on explicit manual dispatch. It skips instead of failing or leaking secrets if the account credentials have not been configured. The CI success badge is *not* proof of a live deployment.

## Production smoke test

After first successful Wrangler deploy:

1. Open the `*.workers.dev` URL printed by Wrangler; `GET /api/health` must show `status: ok`.
2. Verify `POST /api/rooms` creates a 6-character private room with a private membership token.
3. Use four different browsers/devices to join that one invite link.
4. All four ready, host starts. Verify only your own concealed hand displays face-up and each opponent's concealed tiles are hidden.
5. Play a few turns: discard must appear in the correct seat's river, claiming removes the discarded tile from the river and moves it into the claiming player's meld. Bonus tiles remain separate.
6. Toggle offline and online, refresh each browser and verify the room identity, hand, flowers, discards and scores restore correctly.
7. Complete a full round and verify sum of score deltas is zero; ready everyone, play the next round and confirm cumulative scores stay.
8. Check phone viewport for legibility and action button accessibility.
9. Enable deployment logging/alerting and abuse prevention (WAF/rate limiting or Turnstile) before inviting a larger audience.

This production smoke test has **not yet been run** because Cloudflare account authorization is not connected.

## House rules limitation

The current four-player score calculation is labelled *Practice v1*, not an exact new-Malaysian/Malaysian-three-player rule. See [scoring decisions](SCORING_PRACTICE.md). A regional rules acceptance test must be agreed before the UI can claim authentic regional scoring.
