# External subject conformance: AETHER FORGE

This fixture demonstrates that the protocol-neutral verification compiler can evaluate a non-blockchain subject without importing RChain, Casper, Sentinel, or Sovereign-Lattice semantics into the core.

## Source pin

- Repository: `aixaria0/aetherforge`
- Commit: `256fd5a83978e865a7ebcc516eb9956c642b5968`
- File: `src/lib/physics.ts`
- Blob: `4bde80996a058a3c454c2c24654aea00e9873da8`

The frozen snapshot covers face-area samples, the LQC critical-density value, and a symmetric seven-point bounce sample.

## Contract boundary

The domain adapter consumes the generic:

```text
VerificationProblem -> VerificationAdapter -> VerificationArtifact
```

The protocol-neutral core does not import this adapter.

A clean snapshot produces `UNREACHABLE_IN_MODEL` for the declared violation checks. A tampered bounce sample produces `WITNESS_FOUND` with an explicit symmetry violation.

## What this proves

It demonstrates adapter selection and bounded numerical conformance over a non-blockchain subject using the same verification compiler.

## What this does not prove

It does not establish the physical correctness of EPRL, loop quantum cosmology, black-hole entropy calculations, gravitational-wave approximations, or the scientific validity of the AETHER FORGE model. The source pin is provenance metadata and is not authenticated by the adapter.
