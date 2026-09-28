# Cross-Repository Assurance Contract

## Roles

| Repository | v1 role |
|---|---|
| RCHAIN-COMPLIER | Produce verification, repair, native replay binding, and portable propagation envelope |
| rchain-sentinel | Observe/validate transport structure and produce an observation digest |
| rlsenti | Read-only inspection while preserving upstream claim boundaries |
| Sovereign-Lattice | Independently attest the supplied evidence root |

## Portable schema

`causal-assurance-repair-propagation/v1` carries the repair problem identity, repair artifact digest, native receipt digest, native binding digest, pinned upstream repository/commit, selected repair action, native replay flag, and claim boundary.

Consumers must fail closed on unsupported schema, malformed transitive digests, missing provenance identity, or `nativeReplayVerified != true`.

## Trust rule

No consumer may convert transport acceptance, digest equality, or evidence-root attestation into a stronger semantic statement such as “protocol safe” unless independent evidence explicitly supports that stronger claim.
