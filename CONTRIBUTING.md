# Contributing to Smart File Organizer

Thank you for considering contributing! This repository follows a contributor-friendly workflow and aims to keep the codebase clean and testable.

## How to Contribute

1. Fork the repository and create a feature branch from `main`:

```bash
git checkout -b feat/my-feature
```

2. Run tests and lint before making a PR:

```bash
npm install
npm run lint -- --fix
npm test
```

3. Keep changes focused and write tests for new behavior.

4. Submit a Pull Request describing the change and referencing any related issues.

## Coding Standards

- Use `ESM` modules (import/export).
- Classes: PascalCase. Functions/vars: camelCase.
- Keep functions small and single-responsibility.
- Write unit tests for new logic (Jest).

## Branching & Commit Messages

- Use Conventional Commits for commit messages (e.g., `feat: add duplicate detector`).
- Push branches to your fork and open a PR against `main`.

## Issues

- Open an issue describing the problem or feature request, include steps to reproduce where applicable.

## Code Review

- PRs should include tests and clear descriptions.
- Maintain backward compatibility when possible.

## Security

- Do not include secrets in commits. Use `.env` locally and add `.env` to `.gitignore`.

## Thank you

Contributions are welcome. If you'd like guidance on where to start, open an issue with “good first issue” in the title.
