# M23 — Admission to Proposal Bridge

## Question

Can the controlled duplicate-sender candidate move continuously from the active Casper admission boundary into persisted DAG state and then into the next proposal constructor, without an intervening sender-coverage repair?

## Exact revision

```text
rchain-community/rchain-rust
d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b
```

## Three-stage bridge

The exact pinned workflow executes three real upstream stages in one test:

```text
duplicate-sender BlockMessage
        |
        v
casper::validate::block_summary  ----> Ok(())
        |
        v
BlockDagKeyValueStorage::insert
        |
        v
latest_fringe() = {v0,v1,v2}
        |
        v
DagMessageState::create_message()
        |
        v
proposal.fringe = {v0,v1,v2}
```

The candidate has four distinct justification hashes but only three distinct bonded senders: v0 appears twice and v3 is absent.

## Result

The bridge test confirms that the candidate can cross the active block-summary boundary, be persisted by the real DAG storage, and then be consumed by the normal proposal-state constructor with the same three-member fringe.

The important point is continuity. The under-cardinality state is not only observable inside the Finalizer; once the admitted candidate is represented in the DAG, the next proposal constructor continues from that state rather than repairing it.

## Scope

M23 is still an implementation characterization under a deterministic controlled fixture. It does not establish a live-network conflicting-finality exploit.

Combined with M12 (cryptographic ingress), M21 (predicate differential), and M22 (call-site audit), the research chain now spans:

```text
correctly formed ingress
        -> active admission
        -> persisted DAG state
        -> subsequent proposal propagation
```

The remaining hard question is whether a causally reachable adversarial history can turn this state-selection behavior into a concrete protocol safety consequence under realistic network execution.