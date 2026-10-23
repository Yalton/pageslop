# Contributing to Pageslop

Thanks for your interest. Bug reports, fixes and small focused features are welcome.

## Before you start

- For anything larger than a bug fix, open an issue first so we can agree on the approach.
- Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Setup

Follow the **Development** section of the [README](README.md#development). You need Node.js 22 and PostgreSQL 16.

## Making a change

1. Branch from `master`.
2. Keep the change focused; unrelated cleanups belong in their own pull request.
3. Add or update tests in `tests/` (Vitest). Tests mirror the layout of `src/`.
4. If you change the database schema in `src/lib/db/schema.ts`, run `npm run db:generate` and commit the migration in `drizzle/`.
5. If you change the extension, run `npm run ext:lint`.
6. Run the checks:

   ```bash
   npx tsc --noEmit
   npm test
   npm run build
   ```

7. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages, for example `fix(scraper): handle missing og:image`.

## License

Pageslop is licensed under the [AGPL-3.0](LICENSE). By submitting a pull request, you agree that your contribution is licensed under the same terms.
