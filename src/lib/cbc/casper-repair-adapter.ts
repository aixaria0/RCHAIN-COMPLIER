import {
  compileRepair,
  type RepairAdapter,
  type RepairProblem,
  type RepairTransition,
} from "../compiler/repair-compiler.ts";
import {
  compileVerification,
  type VerificationAdapter,
  type VerificationArtifact,
  type VerificationProblem,
} from "../compiler/verification-compiler.ts";
import {
  buildDuplicateMinimumMessageDAG,
  type ConcreteDagFixture,
} from "./casper-concrete-dag.ts";
import { traceCasperFinalizerSemantics } from "./casper-finalizer-semantics.ts";

const PINNED_RCHAIN_RUST = "d92f0787a6096cd6d79864ec2d7c1dd9b6912d0b";

interface CasperRepairState {
  fixture: ConcreteDagFixture;
}

function isFixture(value: unknown): value is ConcreteDagFixture {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConcreteDagFixture>;
  return (
    Boolean(candidate.bondsMap) &&
    Array.isArray(candidate.messages) &&
    Array.isArray(candidate.justifications)
  );
}

function cloneFixture(fixture: ConcreteDagFixture): ConcreteDagFixture {
  return structuredClone(fixture);
}

export function createCasperCoverageVerificationAdapter(): VerificationAdapter {
  return {
    id: "casper-cbc-distinct-minimum-sender-coverage",
    version: "1",
    modelFamily: "casper-cbc-finalizer-discrepancy/v1",
    priority: 60,
    supports(problem) {
      return isFixture(problem.payload);
    },
    verify(problem): VerificationArtifact {
      if (!isFixture(problem.payload)) {
        throw new Error("CBC coverage verifier received an unsupported payload");
      }

      const trace = traceCasperFinalizerSemantics(problem.payload);
      const violation =
        trace.checkMinMessagesPassed &&
        !trace.distinctMinimumMessageCoverage &&
        trace.finalized;

      return {
        schema: "verification-artifact/v1",
        problemId: problem.id,
        modelFamily: problem.modelFamily,
        adapterId: "casper-cbc-distinct-minimum-sender-coverage",
        adapterVersion: "1",
        outcome: violation ? "WITNESS_FOUND" : "UNREACHABLE_IN_MODEL",
        scope: { ...problem.scope },
        assumptions: [...problem.assumptions],
        limitations: [
          "verification uses the repository semantic mirror of the pinned Finalizer data flow",
          "native Rust replay is a separate evidence plane and is not implied by this artifact alone",
          "UNREACHABLE_IN_MODEL means this specific discrepancy is absent in the supplied bounded DAG fixture",
        ],
        ...(violation
          ? {
              witness: {
                minimumMessageSenders: trace.minimumMessageSenders,
                uniqueMinimumMessageSenders: trace.uniqueMinimumMessageSenders,
                bondedSenders: trace.bondedSenders,
                supportingStake: trace.supportingStake,
                totalStake: trace.totalStake,
                finalized: trace.finalized,
              },
            }
          : {}),
        metrics: {
          checkMinMessagesPassed: trace.checkMinMessagesPassed,
          distinctMinimumMessageCoverage: trace.distinctMinimumMessageCoverage,
          finalized: trace.finalized,
          supportingStake: trace.supportingStake,
          totalStake: trace.totalStake,
        },
      };
    },
  };
}

export function createCasperCoverageProblem(
  fixture: ConcreteDagFixture,
): VerificationProblem {
  return {
    id: "casper-cbc-duplicate-minimum-sender-coverage",
    modelFamily: "casper-cbc-finalizer-discrepancy/v1",
    scope: {
      subject: "RChain Rust Finalizer duplicate minimum-message discrepancy",
      upstreamRepository: "rchain-community/rchain-rust",
      upstreamCommit: PINNED_RCHAIN_RUST,
      claim:
        "a count-passing minimum-message set must not finalize while omitting a bonded sender by identity",
    },
    assumptions: [
      "the supplied DAG/message fixture is the complete bounded model for this verification run",
      "the semantic mirror is locked to the observed Finalizer stage ordering at the pinned upstream commit",
      "native Rust conformance is evaluated separately by the M11.5 workflow",
    ],
    payload: fixture,
  };
}

function replacementTransitions(
  fixture: ConcreteDagFixture,
  originalFinalized: boolean,
): RepairTransition[] {
  const byId = new Map(fixture.messages.map((message) => [message.id, message]));
  const justificationMessages = fixture.justifications
    .map((id) => byId.get(id))
    .filter((message): message is NonNullable<typeof message> => Boolean(message));

  const counts = new Map<string, number>();
  for (const message of justificationMessages) {
    counts.set(message.sender, (counts.get(message.sender) ?? 0) + 1);
  }

  const bondedSenders = Object.keys(fixture.bondsMap).sort();
  const represented = new Set(justificationMessages.map((message) => message.sender));
  const missing = bondedSenders.filter((sender) => !represented.has(sender));

  const duplicateMessages = justificationMessages
    .filter((message) => (counts.get(message.sender) ?? 0) > 1)
    .sort((a, b) => a.id.localeCompare(b.id));

  const transitions: RepairTransition[] = [];

  for (const missingSender of missing) {
    const replacements = fixture.messages
      .filter(
        (message) =>
          message.sender === missingSender &&
          !fixture.justifications.includes(message.id),
      )
      .sort(
        (a, b) =>
          b.senderSeq - a.senderSeq ||
          a.id.localeCompare(b.id),
      );

    const replacement = replacements[0];
    if (!replacement) continue;

    for (const duplicate of duplicateMessages) {
      const next = cloneFixture(fixture);
      next.justifications = next.justifications.map((id) =>
        id === duplicate.id ? replacement.id : id,
      );

      const candidateTrace = traceCasperFinalizerSemantics(next);
      const finalizationPenalty =
        candidateTrace.finalized === originalFinalized ? 0 : 1;

      transitions.push({
        to: { fixture: next } satisfies CasperRepairState,
        label: `replace:${duplicate.id}->${replacement.id}`,
        cost: [
          finalizationPenalty,
          1,
          Math.abs(replacement.senderSeq - duplicate.senderSeq),
        ],
        metadata: {
          replacedJustification: duplicate.id,
          replacedSender: duplicate.sender,
          replacementJustification: replacement.id,
          replacementSender: replacement.sender,
          finalizationPreserved: finalizationPenalty === 0,
          distinctCoverageAfter: candidateTrace.distinctMinimumMessageCoverage,
          finalizedAfter: candidateTrace.finalized,
        },
      });
    }
  }

  return transitions;
}

export function createCasperCoverageRepairAdapter(): RepairAdapter {
  return {
    id: "casper-cbc-distinct-sender-repair",
    version: "1",
    modelFamily: "casper-cbc-finalizer-discrepancy/v1",
    priority: 60,
    supports(problem) {
      return isFixture(problem.originalProblem.payload);
    },
    createSearch(problem) {
      const initialFixture = cloneFixture(
        problem.originalProblem.payload as ConcreteDagFixture,
      );
      const originalTrace = traceCasperFinalizerSemantics(initialFixture);

      return {
        initial: { fixture: initialFixture } satisfies CasperRepairState,
        stateKey(state) {
          const fixture = (state as CasperRepairState).fixture;
          return JSON.stringify({
            justifications: [...fixture.justifications].sort(),
            messages: fixture.messages
              .map((message) => ({
                id: message.id,
                sender: message.sender,
                senderSeq: message.senderSeq,
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          });
        },
        expand(state) {
          return replacementTransitions(
            (state as CasperRepairState).fixture,
            originalTrace.finalized,
          );
        },
        toVerificationProblem(state) {
          return createCasperCoverageProblem(
            (state as CasperRepairState).fixture,
          );
        },
        maxStates: 128,
        limitations: [
          "allowed repair actions only replace one duplicate-sender justification with the highest-sequence available message from a missing bonded sender",
          "the first objective preserves the original finalized/non-finalized behavior when possible",
          "native Rust confirmation is provided by the pinned M11.5 upstream workflow, not by this TypeScript artifact",
        ],
      };
    },
  };
}

export function createCasperCoverageRepairProblem(
  fixture: ConcreteDagFixture = buildDuplicateMinimumMessageDAG(),
): RepairProblem {
  const originalProblem = createCasperCoverageProblem(fixture);
  const compiled = compileVerification(originalProblem, [
    createCasperCoverageVerificationAdapter(),
  ]);

  if (
    compiled.status !== "COMPILED" ||
    compiled.artifact === null ||
    compiled.artifact.outcome !== "WITNESS_FOUND"
  ) {
    throw new Error("CBC coverage repair requires an original WITNESS_FOUND artifact");
  }

  return {
    id: "casper-cbc-minimal-distinct-sender-repair",
    modelFamily: originalProblem.modelFamily,
    originalProblem,
    originalArtifact: compiled.artifact,
    objectives: [
      "finalization_behavior_changed",
      "justifications_changed",
      "sender_sequence_delta",
    ],
    payload: {
      repairSpace:
        "replace-duplicate-justification-with-missing-bonded-sender/v1",
    },
  };
}

export function repairCasperDuplicateMinimumSenderCoverage(
  fixture: ConcreteDagFixture = buildDuplicateMinimumMessageDAG(),
) {
  return compileRepair(
    createCasperCoverageRepairProblem(fixture),
    [createCasperCoverageRepairAdapter()],
    createCasperCoverageVerificationAdapter(),
  );
}
