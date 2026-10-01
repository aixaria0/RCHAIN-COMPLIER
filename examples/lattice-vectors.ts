/** PUBLIC TEST SEED: never admit this identity to a deployed lattice. */
import { createPrivateKey } from "node:crypto";
import {
  artifactDigest,
  canonical,
  createEvent,
  EVENT_KINDS,
  EVENT_SCHEMA,
  identityFromKey,
  type MembershipPolicy,
} from "../src/lib/lattice/protocol.ts";
export function conformanceVector() {
  const identity = identityFromKey(
    createPrivateKey({
      key: Buffer.from("302e020100300506032b657004220420" + "01".repeat(32), "hex"),
      format: "der",
      type: "pkcs8",
    }),
  );
  const policy: MembershipPolicy = {
    schema: "intelligence-lattice-policy/v1",
    latticeId: "public-conformance-vectors",
    members: [
      {
        actorId: identity.actorId,
        publicKeyHex: identity.publicKeyHex,
        kinds: [...EVENT_KINDS],
        domains: ["arithmetic"],
      },
    ],
  };
  const input = { b: [true, "tea", null], a: 1 };
  const event = createEvent(identity, policy, {
    sequence: 1,
    issuedAt: "2026-09-30T00:00:00.000Z",
    body: {
      kind: "claim",
      subject: artifactDigest(input),
      predicate: "integer-sum",
      value: 12,
      domain: "arithmetic",
      method: "public-vector",
      assumptions: ["declared input is complete"],
      confidence: { ppm: null, basis: "unknown" },
      falsifier: "independently sum declared integers",
    },
  });
  const { id: _id, signatureHex: _signature, ...unsigned } = event;
  return {
    schema: "intelligence-lattice-vectors/v1",
    warning: "Public test seed 01 repeated 32 bytes; never enroll this key",
    input,
    inputCanonical: canonical(input),
    inputDigest: artifactDigest(input),
    policy,
    event,
    eventCanonical: canonical(event),
    signingBytesHex: Buffer.from(`${EVENT_SCHEMA}\0${canonical(unsigned)}`).toString("hex"),
  };
}
