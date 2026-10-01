# How this differs from in-toto, SLSA, and Sigstore

This project overlaps with supply-chain assurance tooling, but its primary problem is different: preserving the meaning and scope of a **technical claim** as that claim moves through verification, observation, replay, packaging, signing, and optional independent review.

## in-toto

in-toto focuses on describing and verifying a software supply chain as a sequence of authorized steps and materials/products.

This repository borrows the same evidence discipline—explicit artifacts, provenance, and verifiable boundaries—but applies it more broadly to runtime and research claims. A package can bind a witness, observation evidence, replay result, and reviewer decision even when the subject is not a software build pipeline.

## SLSA

SLSA defines supply-chain security levels and provenance expectations around how software artifacts are built.

This repository uses build provenance as one assurance plane, not as the whole assurance model. Build integrity can answer "what produced these bytes?" while this framework also asks "what exactly was claimed, what evidence supports it, was it replayed, and was uncertainty preserved?"

## Sigstore

Sigstore provides signing and verification infrastructure for software artifacts and attestations.

This repository uses cryptographic signing and Sigstore-backed provenance where appropriate, but treats signature validity as narrower than trust:

```text
valid signature != trusted signer
```

The assurance verifier therefore also binds signer identity to an independently configured trust anchor or policy.

## The distinction

A simplified view:

| System | Primary concern |
|---|---|
| in-toto | integrity and authorization of supply-chain steps |
| SLSA | software supply-chain provenance and build hardening |
| Sigstore | artifact/attestation signing and verification infrastructure |
| Causal Assurance Framework | semantic integrity of bounded technical claims across evidence, replay, provenance, and review |

These systems are complementary. The framework can consume provenance or signed attestations from supply-chain tooling as evidence, while still refusing to infer claims those artifacts do not establish.
