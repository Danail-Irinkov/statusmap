# Releasing statusmap

Use Node.js 22.18 or newer for development and release verification. The built
`@statusmap/core` runtime continues to support the `node >=18` range declared in
its package manifest.

This checklist is the release gate for the public `@statusmap/core` and `@statusmap/vue` packages.
Run it from a clean release checkout. Do not publish from a feature checkout or from ignored build output.

## One-time public-repository gates

- Publish from a history that contains only material intended for the public. `node scripts/check-public-history.mjs`
  must pass across every reachable branch and tag. A clean current tree is not enough.
- The repository used during extraction contains deleted private-consumer files in earlier commits. Before v0.1,
  choose a fresh public repository/snapshot or perform a coordinated full ref and tag rewrite. Because the existing
  remote has already been public, treat old history as exposed and review any historical credentials for rotation.
- Confirm that the author email on the public commit is intentional (a GitHub no-reply address is acceptable).
- Enable GitHub private vulnerability reporting and verify the form linked from `SECURITY.md` while signed out.
- Confirm the publishing account can create public packages in the `@statusmap` npm scope and has npm 2FA enabled.

History rewrites are destructive coordination events. Back up refs, stop concurrent pushes, communicate the cutoff,
and verify a fresh unauthenticated clone after the change. This repository does not automate or perform that rewrite.

## Release-candidate proof

```bash
node scripts/check-public-leaks.mjs

cd packages/core
npm ci
npm run build
npm test
npm run typecheck
npm run lint:pkg
npm run pack:dry
npm audit --omit=dev

cd ../vue
npm ci
npm test
npm run typecheck
npm run build:types
npm run build:bundle
npm run lint:pkg
npm run pack:dry
npm audit --omit=dev

cd ../..
node examples/self-roadmap/validate.mjs
node scripts/verify-packed-consumer.mjs
```

Inspect both `npm pack --dry-run` manifests. The packed-consumer gate independently scans the installed tarball
payloads, asserts both packages resolve from the fixture's `node_modules`, checks Vue declarations, runs the stock
Vue 3 + Vite build, and audits production dependencies.

Run `packages/vue/demo-shot.mjs` against a freshly started demo after the final UI change. Inspect the light/dark
390, 768, and 1440 screenshots, keyboard focus, selected-filter, no-match, and feature-detail states. Accessibility,
console, and overflow checks must be green.

## Publish order

1. Confirm the versions and changelogs.
2. Publish `@statusmap/core` with public access and verify a clean registry install.
3. Publish `@statusmap/vue` with public access and verify its core peer resolves.
4. Re-run the packed consumer using registry versions.
5. Create and push the signed/intentional tag and GitHub release.

Publishing, pushing rewritten history, changing repository settings, and creating releases are explicit owner actions;
preparation checks do not perform them automatically.
