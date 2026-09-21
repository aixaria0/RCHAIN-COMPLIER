# M16 — Counterfactual Minimum-Sender Coverage

M16 does not modify the pinned upstream implementation.

It tests the narrowest semantic strengthening suggested by the observed mismatch:

    set(minimum_message_senders) == set(bonded_senders)

The current upstream gate only checks:

    minimum_message_count == bonded_validator_count

Under the duplicate candidate, the count-only gate returns true while the sender-set equality returns false.

The counterfactual test also rejects a different malformed shape with the same entry count — three bonded validators plus one non-bonded sender — while preserving a valid one-message-per-bonded-sender shape.

This establishes a concrete remediation hypothesis:

    current:
      min_msgs.len() == bonds_map.len()

    proposed invariant:
      min_msgs.len() == bonds_map.len()
      AND
      sender_set(min_msgs) == bonded_sender_set

The project does not treat this as a completed upstream fix. It is a compatibility-oriented hypothesis that should next be evaluated against epoch changes, existing finalization tests, and any protocol assumptions around duplicated justifications.
