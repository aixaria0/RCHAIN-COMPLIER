# rchain-assurance/v1

Canonical schema and semantics are owned by RCHAIN-COMPLIER. This contract is only for the bounded REV_TRANSFER_FINALIZED claim. Examples are synthetic fixtures, never live receipts.

Epoch milliseconds are safe nonnegative JSON integers. Missing optional stage details mean unknown, never false or PASS. Required nullable identities and evidence slots explicitly preserve absent evidence. All objects are closed: a package cannot supply policy, trust roots, or a different verifier.

SIGNED → SUBMITTED → EXECUTED → INCLUDED → FINALIZED_STATE_OBSERVED → CROSS_NODE_CORROBORATED → ASSURANCE_VERIFIED are separate stages. Sentinel cannot attest to local signing or submission time it did not observe. Inclusion requires the exact deploy signature in a canonical block. Execution additionally requires a successful deploy result. A finalized-state observation requires explicit node finality for the included block and a balance read at a matching observed finalized block; height alone is insufficient. The verifier binds the exact signed term, signer, recipient, amount and pre-transfer balance through external policy. A balance change alone does not establish transfer causality.

Each raw response retains its exact UTF-8 body, SHA-256 digest, endpoint path, request term for read-only POST and observation time. Digests of observations exclude only observation_digest; the package digest excludes only provenance.payload_digest. Object digests use recursively sorted JSON keys, compact separators, preserved array order and safe integers. reproduction_digest binds stage summaries and observer summaries, excluding raw evidence and observation_digest. The verifier independently derives protocol facts from raw responses and compares all claimed stage identities.

EXACT_AGREEMENT means identical finalized height/hash across configured observers. PROVEN_LAG requires a complete parent-hash ancestry path. HEIGHT_SKEW is unresolved. Same-height different hashes are CONFLICT even if other observers are unavailable. No observer majority overrides a contradiction. Unavailable or stale required observers leave the claim BLOCKED. Node-count agreement is never a stake-weighted Casper finality proof.

PASS requires all bounded checks and an externally selected policy. BLOCKED means incomplete, unavailable, stale or insufficient evidence. FAIL means contradicted invariants, wrong task/claim/network binding, digest mismatch, canonical mismatch or reproduction divergence. Producer verification fields are advisory, never authoritative.

Trust pins must come from operator configuration or a trusted transport receipt: expected task, deploy, claim, network, shard, exact term, signer, transfer context, observer identities/URLs/failure domains, producer revision, package digest, freshness limits and minimum observer/domain counts. The evidence package cannot select these values. The package digest is a content commitment, not authentication; a trusted channel or separately authenticated receipt must supply that pin. Replay only reproduces local checks over observations and does not prove external execution.

## Commands

`npm run test:rchain-assurance` validates the canonical schema with Ajv and the shipped validator, checks generated-schema drift, and runs adversarial verifier controls. `node scripts/rchain-rev-transfer-assurance.mjs PACKAGE.json EXTERNAL_POLICY.json` returns exit 0 (PASS), 2 (BLOCKED) or 1 (FAIL). The policy is a separate operator-selected file. Do not copy trust roots from the observation package.

`npm run pack:assurance` ships the verifier at `@aixaria/assurance-engine/rchain-assurance/v1`. `node scripts/export-rchain-assurance.mjs OUTPUT_DIRECTORY` exports the same browser-safe implementation and file hashes for Rholox. No separate verification implementation belongs in Rholox.

The v1 changes repair the explorer no-empty lint failure and apply only compatible lockfile fixes for brace-expansion and source-map-js. The production package remains free of runtime npm dependencies. Repository and product audit must both remain clean.

Finalized balance observations explicitly request `/api/explore-deploy?blockHash=<observed finalized hash>`. The response block identity and protocol fields must match the canonical finalized block; HTTP success or an ignored query never establishes the selected read-back.
