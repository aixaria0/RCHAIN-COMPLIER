# M13 — NodeRunning Ingress Dispatch

## Purpose

M12 demonstrated that a real, content-addressed and correctly signed duplicate-sender `BlockMessage` crosses the pinned `BlockReceiver` ingress boundary.

M13 closes the layer immediately above it: the pinned Rust `NodeRunning::handle` dispatcher must accept a `CasperMessage::BlockMessage` and place it on the bounded block-ingress queue before `BlockReceiver` performs the hash/signature checks.

## Exact upstream revision

```text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

## Production-path observation

At the pinned revision, `NodeRunning::handle`:
- receives `CasperMessage::BlockMessage`;
- checks only whether the block hash is already known;
- forwards an unknown block to the bounded `incoming_blocks` queue;
- leaves content-addressing and signature validation to `BlockReceiver`.

The M13 test constructs the candidate with the real upstream `ValidatorIdentity` and `hash_block` path, invokes the real `NodeRunning::handle`, and verifies the exact `BlockMessage` is forwarded without being pre-stored.

This matters because the candidate now has a continuous upstream execution boundary:

```text
CasperMessage::BlockMessage
        |
real NodeRunning::handle
        |
bounded incoming_blocks
        |
real BlockReceiver
        |
real hash/signature ingress
        |
validation queue
```

## Scope

M13 does not claim that transport serialization itself is exercised. It tests the post-decode production dispatcher with the exact `CasperMessage::BlockMessage` representation.

It also does not claim a network vulnerability, safety failure, or economic exploit. Those require protocol-impact evidence beyond message admission.

## Evidence boundary

```text
network-decoded message
        |
NodeRunning dispatch        [M13]
        |
BlockReceiver ingress      [M12]
        |
block_summary              [M11.6]
        |
pre-state + Finalizer      [M11.7–M11.9]
        |
full validation
```
