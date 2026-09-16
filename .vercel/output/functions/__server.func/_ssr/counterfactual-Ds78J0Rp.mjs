import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as FieldRow, c as Panel, d as cn, n as MobileNav, o as GhostBtn, p as useWorkbench, u as StatusTag } from "./router-Dksdxy5P.mjs";
import { o as WhyPanel, s as WitnessPanel } from "./envelope-sk4ngsZR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/counterfactual-Ds78J0Rp.js
var import_jsx_runtime = require_jsx_runtime();
function Counterfactual() {
	const { applicableMutations, mutation, setMutation, reality, baseline, diff } = useWorkbench();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Counterfactual reality",
				subtitle: "Remove one fact. Recompute evidence. Report the first violated invariant.",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-2",
					children: applicableMutations.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setMutation(m.id),
						className: cn("rounded-lg border p-3 text-left transition-colors duration-(--motion-quick)", mutation === m.id ? "border-primary/50 bg-elevated" : "border-border bg-bg hover:border-border-strong"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm font-medium",
								children: m.title
							}), mutation === m.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: reality.status }) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: m.summary
						})]
					}, m.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
					title: "Baseline",
					right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: baseline.status }),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "capability",
							value: baseline.qos.capability ?? "ABSENT"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "COMMs",
							value: String(baseline.execution?.comms ?? "n/a")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "block",
							value: baseline.blocks[0]?.hash ?? "UNAVAILABLE",
							unavailable: !baseline.blocks[0]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "agreement",
							value: baseline.cross ? baseline.cross.agreementRatio.toFixed(2) : "UNAVAILABLE",
							unavailable: !baseline.cross
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "committed cert",
							value: String(baseline.lattice?.committedCertificate ?? "n/a")
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
					title: "Counterfactual",
					right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: reality.status }),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "capability",
							value: reality.qos.capability ?? "ABSENT"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "COMMs",
							value: String(reality.execution?.comms ?? "n/a")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "block",
							value: reality.blocks[0]?.hash ?? "UNAVAILABLE",
							unavailable: !reality.blocks[0]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "agreement",
							value: reality.cross ? reality.cross.agreementRatio.toFixed(2) : "UNAVAILABLE",
							unavailable: !reality.cross
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "committed cert",
							value: String(reality.lattice?.committedCertificate ?? "n/a")
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "First divergence",
				subtitle: "The earliest layer whose object changed",
				children: diff.first ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "layer",
						value: diff.first.layer
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "field",
						value: diff.first.field
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "baseline",
						value: diff.first.a
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "counterfactual",
						value: diff.first.b
					}),
					diff.downstream.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-2 font-mono text-micro tracking-label text-muted",
							children: "DOWNSTREAM EFFECTS"
						}), diff.downstream.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: `${r.layer}.${r.field}`,
							value: `${r.a} → ${r.b}`
						}, r.field))]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-muted",
						children: "No further downstream fields changed."
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "No divergence — this is the baseline."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WitnessPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WhyPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GhostBtn, {
					onClick: () => setMutation("none"),
					children: "Return to baseline"
				})
			})
		]
	});
}
//#endregion
export { Counterfactual as component };
