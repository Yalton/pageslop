# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub's [private vulnerability reporting](https://github.com/Citreum-LLC/pageslop/security/advisories/new).

Include the affected version or commit, steps to reproduce, and the impact you expect. You should get a reply within a week. Once a fix is released, we credit reporters who want to be credited.

## Supported versions

Only the latest commit on `master` receives security fixes. Self-hosters should update regularly (`git pull && docker compose up -d --build`).

## Hardening a self-hosted instance

- Generate secrets with `./scripts/setup.sh` rather than writing them by hand.
- Serve the app over HTTPS behind a reverse proxy, and keep the default `127.0.0.1` port binding.
- Set `ALLOW_SIGNUP=false` once your accounts exist.
- Content scraped from saved pages (titles, descriptions) is untrusted. Keep that in mind when exposing it to AI agents through the MCP server.
