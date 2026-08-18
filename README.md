# CopyPaste

Share text between devices with a short code. No login, nothing to install.
Paste, get a code, enter it on another device or scan the QR. Codes auto-expire.

## Features

- **Quick paste** — 4-character code, lasts 15 minutes.
- **Session** — 5-character code, live sync across devices, lasts 1 hour.
- **QR handoff** — scan to open pre-filled; retrieved text auto-copies.
- Codes list with live countdowns. Dark/light. Mobile-ready.

## Develop

Needs [Bun](https://bun.sh) and a free [Convex](https://convex.dev) account.

```bash
bun install
bun run dev   # Convex + Vite; first run links a project and writes .env.local
```

## Scripts

- `dev` — Convex + Vite together
- `build` — production build to `dist/`
- `preview` — serve the build
- `test` — code-generation self-check

## Stack

Convex (reactive backend) + vanilla JS + Vite. No framework.

## Notes

Codes are semi-secret and short-lived; treat pastes as ephemeral, not private storage.

## License

[MIT](LICENSE)
