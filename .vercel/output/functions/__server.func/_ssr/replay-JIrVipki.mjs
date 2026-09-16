import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as FieldRow, c as Panel, d as cn, h as shortHex, n as MobileNav, p as useWorkbench, u as StatusTag } from "./router-Dksdxy5P.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/replay-JIrVipki.js
var import_jsx_runtime = require_jsx_runtime();
function Replay() {
	const { reality, baseline, diff, mutation } = useWorkbench();
	const replay = reality.replay;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
					title: "Observed execution",
					subtitle: "State hash recorded on the block",
					right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: baseline.status }),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "state hash",
							value: baseline.execution?.stateHash ?? "UNAVAILABLE",
							unavailable: !baseline.execution,
							source: "ExecutionTrace",
							field: "state_hash"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "trace hash",
							value: baseline.execution?.traceHash ?? "UNAVAILABLE",
							unavailable: !baseline.execution
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "steps",
							value: String(baseline.execution?.steps.length ?? 0)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "mt-3 max-h-72 space-y-1 overflow-auto",
							children: (baseline.execution?.steps ?? []).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2 font-mono text-xxs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular-nums text-muted",
										children: s.n
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-12 text-primary",
										children: s.rule
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-fg",
										children: s.description
									})
								]
							}, s.n))
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Local replay",
					subtitle: "Reducer re-run against the same process",
					right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: replay?.match ? "PASS" : replay ? "FAIL" : "UNAVAILABLE" }),
					children: replay ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "expected",
							value: replay.expectedStateHash,
							source: "Replay",
							field: "expected_state_hash"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "observed",
							value: replay.observedStateHash,
							source: "Replay",
							field: "observed_state_hash"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "match",
							value: String(replay.match)
						}),
						replay.firstDivergence ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-md border border-fail/40 bg-fail/10 p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-mono text-micro tracking-label text-fail",
									children: "EXECUTION DIVERGENCE"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
									label: "step",
									value: String(replay.firstDivergence.step)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
									label: "object",
									value: replay.firstDivergence.object
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
									label: "expected",
									value: replay.firstDivergence.expected
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
									label: "observed",
									value: replay.firstDivergence.observed
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted",
							children: "Replay matches the observed post-state hash."
						})
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "UNAVAILABLE — no execution to replay."
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "Reality diff",
				subtitle: `${mutation === "none" ? "Baseline vs itself" : `Baseline vs ${mutation}`}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[36rem] text-left text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "font-mono text-micro tracking-label text-muted",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "LAYER"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "FIELD"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "RUN A"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "RUN B"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2",
										children: "Δ"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: diff.rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: cn("border-b border-border/50", r.diverged && "bg-fail/8"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-micro text-primary",
									children: r.layer
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs",
									children: r.field
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "max-w-48 truncate py-2 pr-3 font-mono text-xxs",
									title: r.a,
									children: r.a.startsWith("0x") ? shortHex(r.a) : r.a
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "max-w-48 truncate py-2 pr-3 font-mono text-xxs",
									title: r.b,
									children: r.b.startsWith("0x") ? shortHex(r.b) : r.b
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: cn("py-2 font-mono text-micro", r.diverged ? "text-fail" : "text-muted"),
									children: r.diverged ? "DIFF" : "—"
								})
							]
						}, `${r.layer}.${r.field}`)) })]
					})
				}), diff.first ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-sm text-muted",
					children: [
						"Divergence at ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-fg",
							children: [
								diff.first.layer,
								".",
								diff.first.field
							]
						}),
						" — ",
						diff.downstream.length,
						" downstream field",
						diff.downstream.length === 1 ? "" : "s",
						" changed."
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: "Runs are identical under the current mutation."
				})]
			})
		]
	});
}
//#endregion
export { Replay as component };
