# Minimal Repair Compiler

The verification compiler now has a protocol-neutral repair companion.

```text
WITNESS_FOUND
    ↓
declared repair space
    ↓
lexicographic minimum intervention
    ↓
same claim + same scope + same assumptions
    ↓
same verification adapter
    ↓
UNREACHABLE_IN_MODEL
    ↓
repair-artifact/v1
```

## Anti-cheating boundary

A repair candidate is not allowed to succeed by weakening the claim. The repair compiler binds:

- verification problem id;
- model family;
- scope;
- assumptions;
- verification adapter id and version.

If a repair adapter attempts to change claim identity, the entire repair compilation is `BLOCKED`.

A successful repair therefore means the subject payload changed through a declared intervention and the same verifier re-evaluated the same claim.

## Minimality

`REPAIR_FOUND` carries:

```text
LEXICOGRAPHIC_MINIMUM_WITHIN_DECLARED_REPAIR_SPACE
```

This is deliberately narrower than “best fix”. It says only that no lower-cost repair exists in the explicit bounded state space explored by the adapter.

## AETHER FORGE fixture

The first external subject uses the pinned AETHER FORGE numerical snapshot.

Allowed interventions are intentionally conservative: restore one numeric field to its value in the pinned source snapshot. The objectives are:

1. number of numeric fields changed;
2. absolute numeric delta.

The fixture begins with a deliberately tampered bounce-density sample. The original verifier emits `WITNESS_FOUND`; repair search restores the minimum field; the exact same verification adapter is run again and emits `UNREACHABLE_IN_MODEL`.

This verifies internal numerical conformance only. It does not establish physical correctness or experimental confirmation.
