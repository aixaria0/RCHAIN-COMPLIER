# Four-repository Causal Assurance contract

This branch remains independent of any live RChain/RNode implementation.

The integration boundary is artifact-based:

| Repository | Role | Contract |
| --- | --- | --- |
| RCHAIN-COMPLIER | possibility/conformance/certificate core | produces bounded verification artifacts, portable packages, and signed canonical roots |
| rchain-sentinel | protocol-neutral observation | produces `causal-assurance-evidence/v2`; payload bytes and canonical claims are both bound into evidence identity |
| rlsenti | read-only inspection workbench | imports evidence/certificates without promoting FAIL, BLOCKED, NOT_TESTED, or INCONCLUSIVE states |
| Sovereign-Lattice | optional independent reviewer | produces digest-bound `causal-assurance-attestation/v2` and can add a pinned-key Ed25519 reviewer signature |

No repository is allowed to silently strengthen another repository's verdict.

## Base contract and optional review

The shared manifest is `causal-assurance-ecosystem/v2`.

The base chain is:

```text
WITNESS -> EVIDENCE -> WORKBENCH
```

A reviewer attestation is optional at the base-contract level:

```text
WITNESS -> EVIDENCE -> WORKBENCH -> ATTESTATION
```

Policies that require independent review must set `requireAttestation`; absence of the attestation then fails closed as BLOCKED. The original v1 schema remains preserved and continues to require all four stages.

## Portable package and canonical root

`causal-assurance-portable-package/v2` accepts exactly the three base artifacts and at most one trailing reviewer attestation. Every artifact is independently rehashed from raw bytes, must appear in canonical role order, and must bind all predecessor digests.

The package root uses `causal-assurance-signed-root/v2` with unsigned 32-bit big-endian length-prefixed UTF-8 fields. This removes delimiter ambiguity. The frozen four-artifact conformance vector is independently reproduced by TypeScript and two Rust implementations.

A signed root is accepted only when:
1. the package independently re-verifies;
2. the root recomputes exactly;
3. the embedded Ed25519 key fingerprint matches the envelope key id; and
4. that fingerprint matches an independently pinned expected key id.

An embedded public key never establishes trust by itself.

## Verdict semantics

Verification outcomes are not automatically assurance verdicts. `INCONCLUSIVE` and `LIMIT_REACHED` always map to BLOCKED. Reachability results require an explicit witness interpretation (`VIOLATION` or `SUPPORT`) before they may become PASS or FAIL. Without that polarity, they remain BLOCKED.

The workbench rejects a PASS certificate that contains any critical non-PASS check. Supply-chain checks are represented explicitly rather than being collapsed into another plane.

## Scope

These contracts establish deterministic artifact integrity, transitive evidence binding, explicit trust boundaries, and cross-language conformance. They do not prove that an external protocol implementation is correct.

RChain-specific adapters can be added later. They are not required for the generic core and remain intentionally outside this milestone while the upstream implementation is changing.
