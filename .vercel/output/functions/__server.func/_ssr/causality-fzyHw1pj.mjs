import { t as LAYERS } from "./types-DWWlW26N.mjs";
import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as FieldRow, c as Panel, d as cn, h as shortHex, n as MobileNav, p as useWorkbench, s as Mono, u as StatusTag } from "./router-Dksdxy5P.mjs";
import { s as WitnessPanel, t as EnvelopeCard } from "./envelope-sk4ngsZR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/causality-fzyHw1pj.js
var import_jsx_runtime = require_jsx_runtime();
function Causality() {
	const { reality, envelope, setSelectedEnvelope } = useWorkbench();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Causality explorer",
				subtitle: "Click an envelope. Provenance is a linked chain, not a block list.",
				right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: reality.status }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col",
					children: reality.envelopes.map((e, i) => {
						const meta = LAYERS.find((l) => l.id === e.layer);
						const active = envelope?.eventId === e.eventId;
						const st = e.verificationResults[0] ?? "UNAVAILABLE";
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSelectedEnvelope(e.eventId),
							className: cn("flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left transition-colors duration-(--motion-quick)", active ? "border-primary/50 bg-elevated" : "border-border bg-bg hover:border-border-strong"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-micro tracking-label text-muted",
									children: meta?.label ?? e.layer
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-medium",
									children: e.label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 text-xs text-muted",
									children: e.summary
								})
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-right",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: st }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mono, {
									className: "mt-1 block",
									children: shortHex(e.hash)
								})]
							})]
						}), i < reality.envelopes.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
							className: "h-5 w-full",
							viewBox: "0 0 100 20",
							preserveAspectRatio: "none",
							"aria-hidden": true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
								x1: "16",
								y1: "0",
								x2: "16",
								y2: "20",
								className: "flow-line",
								stroke: "currentColor",
								strokeWidth: "1",
								vectorEffect: "non-scaling-stroke",
								style: { color: "var(--color-border-strong)" }
							})
						}) : null] }, e.eventId);
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnvelopeCard, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WitnessPanel, {})]
			}),
			reality.blocks[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: `Block #${reality.blocks[0].height}`,
				subtitle: "Why does this block exist?",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "hash",
						value: reality.blocks[0].hash,
						source: "FinalizedBlockEvidence",
						field: "block_hash"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "parent",
						value: reality.blocks[0].parentHash,
						source: "FinalizedBlockEvidence",
						field: "parent_hash"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "proposer",
						value: reality.blocks[0].proposer,
						source: "FinalizedBlockEvidence",
						field: "proposer"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "shard",
						value: reality.blocks[0].shard,
						source: "NetworkStatus",
						field: "shard_id"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "post-state",
						value: reality.blocks[0].postStateHash,
						source: "FinalizedBlockEvidence",
						field: "post_state_hash"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "deploys",
						value: reality.blocks[0].deploys.map((d) => d.id).join(", ") || "none",
						source: "FinalizedBlockEvidence",
						field: "deploys"
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "UNAVAILABLE — no block was produced under this origin."
				})
			})
		]
	});
}
//#endregion
export { Causality as component };
