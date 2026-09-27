function check(id, label, path, op, expected = true) {
  return { id, label, path, op, expected };
}

export const SCENARIOS = {
  MAINTAINER_HEALTH: {
    id: "MAINTAINER_HEALTH",
    label: "Read-only RNode maintainer health surfaces agree",
    replay: false,
    checks: [
      check("status_readable", "/api/status is readable", "health.statusReadable", "equals", true),
      check("version_readable", "/version is readable", "health.versionReadable", "equals", true),
      check("capabilities_readable", "/api/capabilities is readable", "health.capabilitiesReadable", "equals", true),
      check("shards_readable", "/api/v1/shards is readable", "health.shardsReadable", "equals", true),
      check("finalized_available", "last finalized block evidence is available", "health.finalizedBlockAvailable", "equals", true),
      check("canonical_consistent", "canonical block response matches finalized-block fields", "health.canonicalConsistency", "equals", true),
      check("node_finalized", "RNode asserts finality for the observed finalized block", "health.nodeReportedFinalized", "equals", true),
      check("bonds_valid", "observed validator bond structure is valid", "health.bondStructureValid", "equals", true),
      check("cross_node_agreement", "configured observers agree on the finalized result", "health.crossNodeAgreement", "equals", true),
    ],
  },

  NODE_BOOT: {
    id: "NODE_BOOT",
    label: "Booted artifact exposes the expected HTTP surface",
    replay: false,
    checks: [
      check("process_running", "node process reaches running state", "node.processRunning", "equals", true),
      check("http_bound", "HTTP listener is bound", "node.httpBound", "equals", true),
      check("health_ok", "/health reports ok", "node.healthOk", "equals", true),
      check("status_readable", "/api/status is readable", "node.statusReadable", "equals", true),
    ],
  },

  TRUST_BOND_ACTIVATE: {
    id: "TRUST_BOND_ACTIVATE",
    label: "Post-genesis validator admission changes semantic state",
    replay: true,
    checks: [
      check("trust_processed", "trust deploy is processed successfully", "trust.processed", "equals", true),
      check("trusted_contains_target", "trusted set contains the target validator", "trust.targetTrusted", "equals", true),
      check("bond_processed", "bond deploy is processed successfully", "bond.processed", "equals", true),
      check("bond_present", "bond map contains the target validator", "bond.present", "equals", true),
      check("active_present", "active validator set contains the target validator", "activation.active", "equals", true),
      check("can_propose", "admitted validator can propose", "activation.canPropose", "equals", true),
    ],
  },

  WITHDRAW_EPOCH: {
    id: "WITHDRAW_EPOCH",
    label: "Withdrawal remains pending until the epoch boundary then exits active state",
    replay: true,
    checks: [
      check("withdraw_processed", "withdraw deploy is processed successfully", "withdraw.processed", "equals", true),
      check("pending_before_boundary", "withdrawal is pending before the epoch boundary", "withdraw.pendingBeforeBoundary", "equals", true),
      check("active_before_boundary", "validator remains active before the epoch boundary", "withdraw.activeBeforeBoundary", "equals", true),
      check("removed_after_boundary", "validator leaves active set after the epoch boundary", "withdraw.removedAfterBoundary", "equals", true),
    ],
  },

  SLASH_PERSISTENCE: {
    id: "SLASH_PERSISTENCE",
    label: "Slash persists every native map it mutates",
    replay: true,
    checks: [
      check("slash_processed", "slash transition executes", "slash.processed", "equals", true),
      check("pending_removed", "pending withdrawal entry is removed from persisted state", "slash.pendingRemoved", "equals", true),
      check("semantic_state_match", "re-read native state matches expected slash semantics", "slash.semanticStateMatch", "equals", true),
    ],
  },

  NATIVE_MERGE: {
    id: "NATIVE_MERGE",
    label: "Native system writes survive multi-parent merge",
    replay: true,
    checks: [
      check("branch_native_write", "branch contains the native write", "merge.branchNativeWrite", "equals", true),
      check("merged_native_write", "merged state contains the native write", "merge.mergedNativeWrite", "equals", true),
      check("post_state_match", "merged post-state matches branch semantics", "merge.postStateMatch", "equals", true),
    ],
  },

  FINALITY_2V: {
    id: "FINALITY_2V",
    label: "Two validators participate and finality advances",
    replay: false,
    checks: [
      check("validator_a_proposed", "validator A proposed", "finality.validatorAProposed", "equals", true),
      check("validator_b_proposed", "validator B proposed", "finality.validatorBProposed", "equals", true),
      check("finality_advanced", "finalized fringe advanced", "finality.advanced", "equals", true),
      check("nodes_agree", "observers agree on finalized result", "finality.nodesAgree", "equals", true),
    ],
  },

  TRANSFER_EFFECT: {
    id: "TRANSFER_EFFECT",
    label: "Transfer confirmation is based on semantic effect",
    replay: false,
    checks: [
      check("deploy_processed", "transfer deploy is processed", "transfer.processed", "equals", true),
      check("recipient_balance_delta", "recipient balance increased", "transfer.balanceDelta", "gt", 0),
    ],
  },

  DOC_SNAPSHOT: {
    id: "DOC_SNAPSHOT",
    label: "Documented testnet facts match observed chain state",
    replay: false,
    checks: [
      check("binary_match", "documented binary matches running binary", "docs.binaryMatch", "equals", true),
      check("genesis_match", "documented genesis matches running chain", "docs.genesisMatch", "equals", true),
      check("validator_set_match", "documented validator set matches observation", "docs.validatorSetMatch", "equals", true),
      check("health_match", "documented health status matches observation", "docs.healthMatch", "equals", true),
    ],
  },
};

export function getScenario(id) {
  const scenario = SCENARIOS[id];
  if (!scenario) {
    throw new Error(`unknown scenario ${id}; choose one of: ${Object.keys(SCENARIOS).join(", ")}`);
  }
  return scenario;
}
