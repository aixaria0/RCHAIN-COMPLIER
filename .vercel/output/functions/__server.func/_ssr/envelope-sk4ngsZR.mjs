import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as FieldRow, c as Panel, h as shortHex, p as useWorkbench, r as EvidenceList, s as Mono, u as StatusTag } from "./router-Dksdxy5P.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/envelope-sk4ngsZR.js
var import_jsx_runtime = require_jsx_runtime();
function EnvelopeCard() {
	const { envelope, reality } = useWorkbench();
	if (!envelope) return null;
	const status = envelope.verificationResults[0] ?? reality.status;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
		title: "Event envelope",
		subtitle: "Cryptographically linked evidence object — Git for execution",
		right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status }),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "event",
				value: envelope.eventId,
				source: "EventEnvelope",
				field: "event_id"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "parent",
				value: envelope.parentEvent ?? "genesis",
				source: "EventEnvelope",
				field: "parent_event"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "layer",
				value: envelope.layer,
				source: "EventEnvelope",
				field: "layer"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "capability",
				value: envelope.actorCapability ?? "ABSENT",
				source: "EventEnvelope",
				field: "actor_capability",
				unavailable: !envelope.actorCapability
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "envelope hash",
				value: shortHex(envelope.hash, 8, 8),
				source: "EventEnvelope",
				field: "hash"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "prev hash",
				value: envelope.prevHash ? shortHex(envelope.prevHash, 8, 8) : "genesis",
				source: "EventEnvelope",
				field: "prev_hash"
			}),
			envelope.blockHash ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "block",
				value: shortHex(envelope.blockHash),
				source: "EventEnvelope",
				field: "block_hash"
			}) : null,
			envelope.executionTraceHash ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "trace",
				value: shortHex(envelope.executionTraceHash),
				source: "EventEnvelope",
				field: "execution_trace_hash"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-muted",
				children: envelope.summary
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EvidenceList, { evidence: envelope.fields })
			})
		]
	});
}
function WhyPanel() {
	const { reality } = useWorkbench();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
		title: "Why this block?",
		subtitle: "Assembled from the envelope chain — not a finality proof",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "space-y-2",
			children: reality.why.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex gap-3 text-sm leading-snug",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-micro tabular-nums text-muted",
					children: String(i + 1).padStart(2, "0")
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: line })]
			}, i))
		})
	});
}
function WitnessPanel() {
	const { reality } = useWorkbench();
	if (!reality.witness) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
		title: "Failure witness",
		subtitle: "First unsatisfied invariant, if any",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "No failure witness — all selected invariants satisfied or unavailable."
		})
	});
	const w = reality.witness;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
		title: "Failure witness",
		subtitle: "First place reality diverged",
		right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: w.verification }),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "layer",
				value: w.layer
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "invariant",
				value: `${w.invariantId} · ${w.invariant}`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "expected",
				value: w.expected,
				source: w.source,
				field: w.field
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "observed",
				value: w.observed,
				source: w.source,
				field: w.field
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: w.impact
			})
		]
	});
}
function QlfPanel() {
	const { reality } = useWorkbench();
	const q = reality.qlf;
	if (!q) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
		title: "QLF certificate",
		subtitle: "Event-level logical certificate — not a chain proof",
		right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: q.balanced ? "PASS" : "FAIL" }),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-3 font-mono text-lg tracking-[0.4em] text-evidence",
				children: q.phaseString || "∅"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "count(+)",
				value: String(q.countPos),
				source: "QLF",
				field: "count_pos"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "count(−)",
				value: String(q.countNeg),
				source: "QLF",
				field: "count_neg"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "spectral gap",
				value: String(q.spectralGap),
				source: "QLF",
				field: "spectral_gap"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "symmetric",
				value: String(q.symmetric),
				source: "QLF",
				field: "symmetric"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "hermitian",
				value: "true",
				source: "QLF",
				field: "toSpectralMode_hermitian"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
				label: "spectral form",
				value: q.spectralForm,
				source: "QLF",
				field: "spectral_form"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border font-mono text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-elevated p-3 text-center",
						children: q.matrix[0][0]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-elevated p-3 text-center text-muted",
						children: q.matrix[0][1]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-elevated p-3 text-center text-muted",
						children: q.matrix[1][0]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-elevated p-3 text-center",
						children: q.matrix[1][1]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-muted",
				children: q.claim
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-subtle",
				children: q.notClaimed
			})
		]
	});
}
function SourcePanel() {
	const { reality } = useWorkbench();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
		title: "Rholang process",
		subtitle: "Normalized process compiled from the QuantumOS event",
		children: [reality.rholangSource ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
			className: "overflow-auto rounded-md bg-bg p-3 font-mono text-xxs leading-relaxed text-fg",
			children: reality.rholangSource
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "UNAVAILABLE — no process deployed (capability missing)."
		}), reality.execution ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
					label: "COMMs",
					value: String(reality.execution.comms),
					source: "ExecutionTrace",
					field: "comms"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
					label: "state hash",
					value: reality.execution.stateHash,
					source: "ExecutionTrace",
					field: "state_hash"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
					label: "trace hash",
					value: reality.execution.traceHash,
					source: "ExecutionTrace",
					field: "trace_hash"
				})
			]
		}) : null]
	});
}
function ReductionPanel() {
	const { reality } = useWorkbench();
	if (!reality.execution) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
		title: "ρ-calculus reduction",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "UNAVAILABLE — nothing to reduce."
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
		title: "ρ-calculus reduction",
		subtitle: "NEW binds unforgeables; COMM is the rspace match",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "space-y-1",
			children: reality.execution.steps.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex gap-3 rounded-md px-1 py-1 font-mono text-xxs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular-nums text-muted",
						children: s.n
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-14 text-primary",
						children: s.rule
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 break-all text-fg",
						children: s.description
					})
				]
			}, s.n))
		})
	});
}
function ExchangePanel() {
	const { reality } = useWorkbench();
	if (!reality.exchange) return null;
	const pools = Object.values(reality.exchange.pools);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
		title: "Exchange state",
		subtitle: "prepare → prepareReceive → commit/abort · per-pool conservation",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 sm:grid-cols-2",
			children: pools.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-md border border-border bg-bg p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mono, { children: p.id }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-micro text-muted",
							children: p.shard
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "rate",
						value: `${p.rate} / 1e6`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "reserve A",
						value: String(p.reserveA)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "reserve B",
						value: String(p.reserveB)
					}),
					Object.entries(p.balances).map(([who, b]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: `${who} bal`,
						value: `A ${b.a} · B ${b.b}`
					}, who))
				]
			}, p.id))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "mt-3 space-y-1",
			children: reality.exchange.events.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex gap-2 font-mono text-xxs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: e.ok ? "text-pass" : "text-fail",
						children: e.ok ? "ok" : "no"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-primary",
						children: e.verb
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: e.detail
					})
				]
			}, i))
		})]
	});
}
//#endregion
export { SourcePanel as a, ReductionPanel as i, ExchangePanel as n, WhyPanel as o, QlfPanel as r, WitnessPanel as s, EnvelopeCard as t };
