# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning for the published packages once releases
are cut from this public repository.

## Unreleased

## 0.1.0 - 2026-07-17

- Stabilized the v0.1 core entry point by keeping unfinished schema automation private.
- Added generated Vue declarations while preserving the source-runtime contract, plus package metadata,
  package linting, dry-pack, and a clean packed-consumer build gate.
- Improved the explorer's empty search recovery, filter clarity, mobile layout, keyboard focus,
  reduced-motion behavior, landmarks, dark-mode contrast, and default synthetic demo.
- Prevented screencast frame data from being parsed as HTML and added a regression test.
- Added current-tree and final-tarball leak checks and documented the runner execution trust boundary.
- Added public repository documentation for installation, development, CI, release,
  contribution, security, and licensing.
- Added GitHub Actions CI for the package-local core and Vue checks.
- Removed private consumer extraction helpers from the public package tree.
- Initial extracted package scope: `@statusmap/core` and `@statusmap/vue`.
