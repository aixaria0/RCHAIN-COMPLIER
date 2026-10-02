# Security Policy

RCHAIN-COMPLIER provides bounded local assurance infrastructure and integrations that explore consensus-sensitive implementation behavior. The separately packaged Assurance Engine 0.3.x requires Node.js >=22.18 on Linux. Earlier research snapshots do not carry a supported-service guarantee.

## Trust boundaries

The engine uses private local Ed25519 keys, fixed membership, loopback HTTP and trusted deterministic verifier code. Separate worker processes and keys establish distinct process identities, not independent organizations, privileged-user isolation or protection against a malicious host operator. Do not expose the loopback services through a public proxy. There is no remote authentication or multitenant execution sandbox.

Packages contain public keys but cannot establish their own trust. Reviewers must independently supply policy/task/claim pins and should retain the exact package digest to detect coherent truncation. Producer-generated review context is a convenience; downloading both context and evidence from an untrusted source is not verification of that source's identity. A PASS report concerns a bounded task and registered verifier, not universal safety or permission to execute an external action.

Operator verifier modules execute trusted local code with the operator's privileges. Their entry-file digest detects drift, not a complete dependency/build attestation. Never accept plugin paths or code from workload/evidence input. Keep workspace directories mode 0700, keys mode 0600 and use one supervisor per workspace. Do not publish private workspace keys, live databases or WAL files as demo artifacts. Retain public canonical exports separately before migration/recovery.

Resource exhaustion is bounded by package/event/file/depth/capacity limits, connection limits, zero waiting task queue and deadlines. The synchronous trusted verifier must itself enforce input and runtime bounds. Hostile verifier code requires a separate sandbox design; deadline timers cannot interrupt arbitrary blocking JavaScript.

## Reporting

Do not use a public issue to publish an actionable network exploit, private key material, credentials, unpublished testnet access, or other operationally sensitive information.

For a suspected security-sensitive finding:

1. preserve the exact upstream revision;
2. preserve the smallest deterministic reproducer;
3. separate confirmed implementation behavior from inferred impact;
4. prefer a private GitHub Security Advisory or direct maintainer coordination for sensitive details.

Research results that are non-sensitive and already reproducible in a controlled fixture can be discussed publicly with the same evidence-first boundaries used by this project.

This repository is not an official RChain security-response channel.
