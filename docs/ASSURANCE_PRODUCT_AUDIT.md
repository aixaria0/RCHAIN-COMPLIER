# Product audit and bounded first increment

Baseline: main `8bd7604d59b5c9975221751b3741dca0cd17d5da`. Inspected the complete tracked inventory and CI workflows, then traced protocol/canonicalization, replay, journals, transport/worker execution, demos, compiler package verification, schemas, packaging/configuration, security/release docs and integration paths. No AGENTS.md or architectural replacement requirement was present. The baseline lattice suite passed 37/37 tests before changes.

| Requirement | Existing evidence | Increment / remaining boundary |
| --- | --- | --- |
| Public submit/verify interface | Low-level lattice exports, fixture-specific process examples; RChain-shaped assurance verifier | Typed reusable SDK, workload schema, CLI and independent generic evidence verifier |
| Explicit schemas/versioning | Signed events/policy/tasks and canonical golden vectors; task missing from structural event JSON Schema | Preserve wire/signatures; publish standalone TaskEnvelope and correct event schema; new versioned workload/package/context/report/config |
| Crypto/canonical trust | Restricted canonical JSON, domain-separated Ed25519/SHA-256, fixed membership | Reuse unchanged; reject package-controlled reviewer policy/task/claim; optional retained byte digest catches truncation |
| Three-process lifecycle | Strong arithmetic/C192 demonstrations and distinct actor certificates | Persistent reusable supervisor and separate owner/two worker processes; owner cannot issue verifier receipts under generated policy |
| Durable recovery/replay | WAL/FULL journals, atomic writes, corruption/index checks, duplicate idempotency; kill/rejoin tests | OS-released SQLite supervisor lock, idempotent workload submission, close/reopen/recover and compiled supervisor-kill test |
| Provenance/status | Replay tracks wrong-task scope, missing parents, equivocation and locally reproduced receipts | Explicit PASS/BLOCKED/FAIL report; two non-submitter identities; relevant causal blockers cannot pass |
| Input/resource bounds | 16 KiB events, 32-event batches/pages, 4096-event storage/replay, peer limits/deadlines | 8 MiB canonical packages, bounded file reads, single active task/zero waiting queue, explicit HTTP in-flight/single-socket limits, BUSY backpressure and task timeout |
| Diagnostics/error taxonomy | Loopback health/view; core errors were message strings and worker exceptions suppressed | Product error codes, structured stderr task/process/verifier diagnostics, journal metrics/status command; low-level native causes preserved |
| New integrations | Verifier registry in replay, C192 verifier embedded with core | Thread registry through node/journal/receipts; move C192 implementation into integration source; trusted local plugin module; legacy defaults preserved |
| Demo/sample/tamper | Powerful demonstrations with temporary deleted state | Product demo retains public sample/review pins and private workspace; restart equality, modified digest/signature and false-claim cases |
| External installation | Private UI/research package, no typed distributable or bin | Separate zero-runtime-dependency ESM tarball, declarations, CLI, schemas/docs/license; clean offline consumer smoke gate |
| CI | UI quality/build, compiler/reality/lattice gates and dedicated upstream Rust/devnet/campaign workflows | Additional product format/lint/type/test/package/install matrix and checksums/evidence artifacts; existing gates preserved |
| Meaningful adversarial coverage | Seeded replay reorder/duplicates, malformed transport, false signatures/receipts, wrong tasks, cursor corruption | Package mutations/truncation/BOM/UTF-8/ordering/size, signed substitution, submitter quorum exclusion, plugin drift, killed owner/supervisor, held-body backpressure |
| Security/versioning/release | Research reporting policy and separate trusted-build provenance workflow | Product threat boundaries, supported runtime, compatibility/migration rules and candidate release artifacts; no implicit publisher identity or license change |
| Concise README / architecture | README mixed product and evolving campaign conclusions | Product quick start and contract links; old overview preserved with baseline provenance in research docs |

CI inventory was preserved: general CI, assurance-provenance, lattice, verification-core, reality; M11.5/6/7 upstream probes; C192 live witness; paired model/Rust/production wiring; devnet smoke and repeated campaign. Changes to README still trigger the existing expensive RChain gates; they were not bypassed to obtain a green badge. Product CI tests both Node 22/24 and publishes only selected public package/report files, never private workspace keys or journals.

No dead-code deletion was justified by the audit. Older demos, compiler APIs, RChain witnesses and research records have reproducibility value and remain available. Only duplicated product responsibility was extracted: the C192 verifier moved without semantic rewrite and bounded page retrieval was reused by both exchange and product export.

## Boundaries needing a separate product decision

The first supported deployment is local, one trusted operator, fixed three-member identities and trusted bounded deterministic verifiers. A remote or multitenant service requires an explicit authentication/authorization, key custody and plugin sandbox design. History beyond 4096 events / 8 MiB packages requires an archival/checkpoint protocol retaining equivocation and deletion detection. These are future contract decisions; they are not solved by relaxing limits or deleting evidence.

The source license is proprietary. An installable release candidate does not grant new rights; publication/redistribution terms and a stable 1.0 support promise remain owner decisions. No npm registry publication, tag, merge or deployment is performed by the packaging scripts.

The product does not assert maximum efficiency, a third-party code-quality score, full RChain repair/finality, independent organizational trust, hidden-evidence completeness or hardware power-loss durability. Test and release artifacts support the bounded behaviors they actually execute.
