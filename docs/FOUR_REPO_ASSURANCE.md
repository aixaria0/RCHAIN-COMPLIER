# Four-repository Causal Assurance contract

This branch remains independent of any live RChain/RNode implementation.

The integration boundary is artifact-based:

| Repository | Role | Contract |
| --- | --- | --- |
| RCHAIN-COMPLIER | possibility/conformance/certificate core | produces bounded witness and assurance artifacts |
| rchain-sentinel | protocol-neutral observation | produces causal-assurance-evidence/v1 |
| rlsenti | read-only inspection workbench | imports certificate/evidence without promoting verdicts |
| Sovereign-Lattice | optional independent reviewer attestation | binds reviewer decision to certificate + scope digests |

No repository is allowed to silently strengthen another repository's verdict.

The shared manifest is causal-assurance-ecosystem/v1. Each stage is digest-bound and may independently be PASS, FAIL, BLOCKED, or NOT_TESTED.

RChain-specific adapters can be added later. They are not required for the generic core and are intentionally outside this milestone while the upstream implementation is changing.
