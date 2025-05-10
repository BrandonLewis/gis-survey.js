# Contributing to gis-survey.js

Thank you for considering contributing to gis-survey.js! This document outlines the commit conventions and development workflow.

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This enables automatic versioning and changelog generation.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

The commit type determines how version numbers are incremented:

- `feat:` A new feature (triggers a minor version bump, e.g., 1.0.0 -> 1.1.0)
- `fix:` A bug fix (triggers a patch version bump, e.g., 1.0.0 -> 1.0.1)
- `docs:` Documentation changes only (no version bump unless scope is README)
- `style:` Changes that don't affect code functionality (triggers a patch version)
- `refactor:` Code changes that neither fix a bug nor add a feature (triggers a patch version)
- `perf:` Performance improvements (triggers a patch version)
- `test:` Adding or updating tests (no version bump)
- `chore:` Changes to the build process, tooling, etc. (no version bump)

### Breaking Changes

Include `BREAKING CHANGE:` in the commit body or footer to trigger a major version bump (e.g., 1.0.0 -> 2.0.0):

```
feat(api): change the parameters of the mapping function

BREAKING CHANGE: The mapping function now requires a configuration object instead of individual parameters.
```

### Scope (Optional)

The scope specifies the part of the codebase affected:

```
fix(core): resolve coordinate transformation issue
feat(tools): add new measurement tool
```

## Development Workflow

1. **Setup**: `npm install`
2. **Development**: `npm run dev` (watch mode)
3. **Linting**: `npm run lint`
4. **Testing**: `npm test`
5. **Building**: `npm run build`
6. **Documentation**: `npm run docs`

## Release Process

Releases are automated using semantic-release. When code is merged to the master branch:

1. The semantic-release workflow runs
2. Version numbers are determined based on commit messages
3. Changelog is updated
4. npm package is published
5. CDN distribution files are updated

There's no need to manually bump version numbers or create releases - just follow the commit conventions!