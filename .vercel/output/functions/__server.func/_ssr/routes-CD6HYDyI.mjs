import { t as LAYERS } from "./types-DWWlW26N.mjs";
import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as Panel, d as cn, f as LAYER_ORDER, m as SCENARIOS, n as MobileNav, o as GhostBtn, p as useWorkbench, u as StatusTag } from "./router-Dksdxy5P.mjs";
import { a as SourcePanel, i as ReductionPanel, n as ExchangePanel, o as WhyPanel, r as QlfPanel, s as WitnessPanel, t as EnvelopeCard } from "./envelope-sk4ngsZR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CD6HYDyI.js
var import_jsx_runtime = require_jsx_runtime();
function pick(reality, id) {
	const inv = reality.invariants.filter((i) => i.layer === id);
	if (!inv.length) {
		if (id === "rholang" || id === "rchain") return reality.execution ? "PASS" : "UNAVAILABLE";
		if (id === "block") return reality.blocks.length ? "PASS" : "UNAVAILABLE";
		if (id === "verification") return reality.status;
		return "UNAVAILABLE";
	}
	if (inv.some((i) => i.status === "FAIL")) return "FAIL";
	if (inv.some((i) => i.status === "WARN")) return "WARN";
	if (inv.every((i) => i.status === "UNAVAILABLE")) return "UNAVAILABLE";
	return "PASS";
}
function PipelineSpine() {
	const { reality, playhead, envelope, setSelectedEnvelope } = useWorkbench();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
		className: "flex flex-col",
		children: LAYERS.map((layer, i) => {
			const visible = playhead > i;
			const status = pick(reality, layer.id);
			const env = reality.envelopes.find((e) => e.layer === layer.id);
			const active = envelope?.layer === layer.id;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: cn(!visible && playhead < LAYER_ORDER.length ? "opacity-25" : "rise-in"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => env && setSelectedEnvelope(env.eventId),
					className: cn("flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color] duration-(--motion-fast) ease-[var(--ease-smooth-out)]", active ? "border-primary/50 bg-elevated" : "border-border bg-surface hover:border-border-strong"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 font-mono text-micro tabular-nums text-muted",
						children: String(i + 1).padStart(2, "0")
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm font-medium",
								children: layer.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-0.5 text-xs text-muted",
							children: layer.role
						})]
					})]
				}), i < LAYERS.length - 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
					className: "h-5 w-full",
					viewBox: "0 0 100 20",
					preserveAspectRatio: "none",
					"aria-hidden": true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: "18",
						y1: "0",
						x2: "18",
						y2: "20",
						className: "flow-line",
						stroke: "currentColor",
						strokeWidth: "1",
						vectorEffect: "non-scaling-stroke",
						style: { color: "var(--color-border-strong)" }
					})
				}) : null]
			}, layer.id);
		})
	});
}
function Home() {
	const { scenario, setScenario, reality, applicableMutations, mutation, setMutation } = useWorkbench();
	const meta = SCENARIOS.find((s) => s.id === scenario);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "rounded-xl border border-border bg-surface p-4 sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-micro tracking-label text-primary",
						children: "PROVENANCE COMPILER"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-1 text-2xl font-medium tracking-display sm:text-3xl",
						children: "From capability to independently checkable evidence."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-2xl text-sm text-muted",
						children: "Compile a QuantumOS event into a Rholang process, reduce it, record a block, observe it, and evaluate formal-shaped invariants. Each layer keeps its own claim."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Scenario",
				subtitle: "The event the compiler will originate",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-2 sm:grid-cols-2",
					children: SCENARIOS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setScenario(s.id),
						className: cn("rounded-lg border p-3 text-left transition-colors duration-(--motion-quick)", scenario === s.id ? "border-primary/50 bg-elevated" : "border-border bg-bg hover:border-border-strong"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm font-medium",
								children: s.title
							}), s.killer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-micro tracking-label text-evidence",
								children: "KILLER DEMO"
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: s.summary
						})]
					}, s.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "Counterfactual",
				subtitle: "Mutate one fact, recompile, watch the first divergence",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: applicableMutations.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GhostBtn, {
						active: mutation === m.id,
						onClick: () => setMutation(m.id),
						children: m.title
					}, m.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-xs text-muted",
					children: applicableMutations.find((m) => m.id === mutation)?.summary
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Compilation spine",
					subtitle: meta.title,
					right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: reality.status }),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PipelineSpine, {})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnvelopeCard, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WitnessPanel, {})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QlfPanel, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourcePanel, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReductionPanel, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangePanel, {})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WhyPanel, {})
		]
	});
}
//#endregion
export { Home as component };
