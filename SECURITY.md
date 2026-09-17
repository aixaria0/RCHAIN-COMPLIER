# Security Policy

## Scope

Security issues affecting verification integrity, evidence provenance, authentication/session boundaries, server-side request handling, or sensitive data handling are in scope.

Do not include secrets, private keys, credentials, personal data, or exploit payloads in public issues.

## Reporting

For a vulnerability that could expose credentials, compromise a deployment, or corrupt verification evidence, contact the repository maintainer privately through the GitHub account associated with this project rather than publishing operational details in a public issue.

Please include:

- affected component or path;
- impact;
- reproducible steps or a minimal proof of concept;
- affected version/commit;
- any suggested mitigation.

## Security design goals

The project aims to keep authentication, external integrations, and presentation separate from deterministic verification logic. Verification artifacts should be inspectable and reproducible without requiring trust in the UI layer.
