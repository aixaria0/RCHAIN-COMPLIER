# v1 Schema Index

| Schema | Producer / consumer | Purpose |
|---|---|---|
| `verification-artifact/v1` | RCHAIN-COMPLIER | bounded verification result |
| `repair-artifact/v1` | RCHAIN-COMPLIER | minimal repair result within declared search space |
| `causal-assurance-repair-package/v1` | RCHAIN-COMPLIER | original → repair → post-repair transitive package |
| `causal-assurance-repair-signed-root/v1` | RCHAIN-COMPLIER | pinned-key signature over canonical package root |
| `cbc-native-repair-replay/v1` | upstream replay → COMPLIER | native Rust before/after receipt |
| `cbc-native-repair-binding/v1` | RCHAIN-COMPLIER | binds native receipt to compiler-selected repair |
| `causal-assurance-repair-propagation/v1` | COMPLIER → consumers | portable cross-repository evidence identity |
| `sentinel-repair-observation/v1` | rchain-sentinel | deterministic transport observation |
| `causal-assurance-repair-attestation/v1` | Sovereign-Lattice | independent evidence-root attestation |

## Canonical digest form

Transport-level SHA-256 identities use lowercase `sha256:` followed by exactly 64 hexadecimal characters where the relevant contract requires canonical digest syntax.

Schema version changes are required when a semantic interpretation changes. v2 must not silently reinterpret v1 artifacts.
