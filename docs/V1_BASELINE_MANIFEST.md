# v1 Assurance Baseline Manifest

Frozen documentation baseline: 2026-09-28.

| Repository | Baseline branch | Documentation-pass HEAD |
|---|---|---|
| aixaria0/RCHAIN-COMPLIER | feat/assurance-fabric-v1 | 2e08812e945a1d2ce73ace04e489dc056644b35e |
| aixaria0/rchain-sentinel | feat/repair-assurance-propagation | 7ffde4bb6e13a08659c65e80fe8d50e7ffa4c5c4 |
| aixaria0/rlsenti | feat/generic-assurance-inspector | 631217023e39c092719838415d61d3f7be1b0c04 |
| aixaria0/Sovereign-Lattice | feat/repair-assurance-attestation | 477e7c09b6dac9b6c560906b5210944729480a6d |

These SHAs identify the documentation hardening pass and are not release tags.

## v1 schemas

- `verification-artifact/v1`
- `repair-artifact/v1`
- `causal-assurance-repair-package/v1`
- `causal-assurance-repair-signed-root/v1`
- `cbc-native-repair-replay/v1`
- `cbc-native-repair-binding/v1`
- `causal-assurance-repair-propagation/v1`
- `sentinel-repair-observation/v1`
- `causal-assurance-repair-attestation/v1`

## Required gates

The release candidate is acceptable only when the current HEAD workflows for the four repositories are green. Native replay, binding, propagation, observation, inspection, and attestation failures are blocking.

## Non-claims

This baseline does not claim live-network ingress, production-wide Casper safety/finality, equivalence between PBFT and Casper CBC, or that integrity/attestation alone establishes semantic truth.

## Change rule for v2

v2 may add temporal graphs, regression localization, verifier diversity, disagreement analysis, and broader repair synthesis. It must version schemas when semantics change and must not silently reinterpret v1 artifacts.
