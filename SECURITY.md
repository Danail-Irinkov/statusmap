# Security Policy

## Supported versions

Security fixes are handled on the latest published minor version of `@statusmap/core`
and `@statusmap/vue`.

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities.

Report security issues through [GitHub private vulnerability reporting](https://github.com/Danail-Irinkov/statusmap/security/advisories/new).
If that form is unavailable, do not put vulnerability details in a public issue; contact the maintainer
through an existing private channel first. Include:

- affected package and version
- impact and attack scenario
- reproduction steps or a minimal proof of concept
- any known mitigations

We will acknowledge reports as soon as practical, assess severity, and coordinate a
fix and disclosure timeline.

## Scope

statusmap renders local project status data and can ingest local test artifacts.
Treat ledgers, screenshots, and test reports as potentially sensitive project data.
Do not publish private consumer ledgers or local environment paths in public issues,
pull requests, or examples.
