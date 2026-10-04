# Omega Node v0.1

Omega Node is a verifiable local control-plane layer over the RCHAIN-COMPLIER Assurance Engine. It does not replace the assurance protocol. It gives the existing three-process engine a strict operational state model and a short-lived signed liveness proof.

## What `ONLINE` means

`ONLINE` is computed, never configured. A node is `ONLINE` only when all of these invariants hold at the same check:

- all three managed Assurance Engine processes answer their loopback health endpoints;
- all three observed actor IDs match the fixed membership policy;
- the process IDs are distinct;
- both non-owner workers are healthy and identity-bound;
- the owner journal can be read and independently replayed through the configured verifier registry;
- the replay produces an event root;
- no equivocation is present in the replay view;
- the verifier registry loaded successfully, including any pinned operator verifier module.

A missing worker or failed health endpoint produces `DEGRADED`. Identity mismatch or replay equivocation produces `COMPROMISED`.

Workload-level `BLOCKED` or `FAIL` results do not automatically make the node compromised. Omega separates node integrity from the truth or completion of an individual task.

## Identity model

Omega distinguishes persistent node identity from boot identity:

- `nodeId` is derived from the persistent Assurance membership-policy digest;
- `bootId` is a fresh UUID generated whenever the Omega supervisor is opened.

Restarting the same initialized workspace therefore preserves `nodeId` but changes `bootId`.

## Proof model

`GET /omega/proof` returns `omega-proof/v1`. The payload contains the node/boot IDs, policy digest, owner identity, current event root, the full Omega status snapshot, issue time and expiry time. The owner Ed25519 identity signs the canonical payload.

A verifier accepts the proof only when:

1. the signature is valid;
2. node, policy and owner values match independently retained `omega-trust/v1` pins;
3. the proof is fresh (default lifetime: 30 seconds; hard maximum: 5 minutes);
4. the signed status itself satisfies every `ONLINE` invariant.

This is a local-host liveness attestation. It proves that the configured Omega supervisor signed a fresh status derived from the live local Assurance processes. It does **not** establish malicious-host isolation, TPM/TEE attestation, independent organizational operators, remote network trust, or post-quantum transport.

## Operator flow

Requires Node.js 22.18+ on Linux.

```bash
# 1. Initialize the durable node and write trust pins OUTSIDE the workspace.
node --experimental-strip-types src/lib/omega/cli.ts init /srv/omega-node ./omega-trust.json

# 2. Start the node. Port 0 chooses an ephemeral loopback port.
node --experimental-strip-types src/lib/omega/cli.ts start /srv/omega-node 9010

# 3. In another shell, inspect the live service.
node --experimental-strip-types src/lib/omega/cli.ts status http://127.0.0.1:9010

# 4. Verify a fresh signed liveness proof using independently retained pins.
node --experimental-strip-types src/lib/omega/cli.ts prove http://127.0.0.1:9010 ./omega-trust.json
```

A valid proof exits zero and returns:

```json
{
  "schema": "omega-proof-report/v1",
  "status": "PASS",
  "code": "VERIFIED"
}
```

`inspect DIRECTORY` temporarily opens the workspace and computes status. `recover DIRECTORY` restarts/rejoins the three durable identities and then recomputes the invariants. They are offline operator operations; a running supervisor owns the workspace lock and prevents a second supervisor.

## Loopback API

The Omega service binds only to `127.0.0.1`.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Minimal state, node ID and boot ID |
| `GET /omega/status` | Full live invariant report |
| `GET /omega/proof` | Short-lived Ed25519-signed liveness proof |
| `GET /omega/trust` | Convenience view of current public trust material; do not treat material fetched from an untrusted node as an independent pin |

There is intentionally no remote signing endpoint, task execution endpoint, key export, recovery mutation, or arbitrary code endpoint.

## PQC boundary

Omega v0.1 does **not** claim Kyber/ML-KEM protection. The current persistent identities are Ed25519 and the service is loopback HTTP. A future PQC transport layer must be implemented and tested separately before the status surface may claim ML-KEM protection.

## Verification gates

```bash
npx tsc -p tsconfig.omega.json --noEmit
npx eslint src/lib/omega --max-warnings 0
node --experimental-strip-types --test src/lib/omega/*.test.ts
npm run test:assurance
```

The dedicated GitHub Actions workflow runs all four gates for Omega changes.
