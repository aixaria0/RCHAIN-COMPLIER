import { t as LAYERS } from "./types-DWWlW26N.mjs";
import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as Panel, n as MobileNav, p as useWorkbench, u as StatusTag } from "./router-Dksdxy5P.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/architecture-CP1x7qxP.js
var import_jsx_runtime = require_jsx_runtime();
function Architecture() {
	const { reality } = useWorkbench();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Vertical architecture",
				subtitle: "One responsibility per repository — not a fusion",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "space-y-2",
					children: LAYERS.map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-bg p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-baseline justify-between gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-micro tabular-nums text-muted",
									children: String(i + 1).padStart(2, "0")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "flex-1 text-sm font-medium",
									children: l.label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-micro text-primary",
									children: l.repo
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: l.role
						})]
					}, l.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Claim boundaries",
				subtitle: "What each layer is allowed to say",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-2",
					children: reality.claims.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "rounded-lg border border-border bg-bg p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-micro tracking-label text-primary",
									children: c.layer
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: c.status })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm",
								children: c.statement
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted",
								children: ["Basis: ", c.basis]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-subtle",
								children: ["Not claimed: ", c.notClaimed]
							})
						]
					}, c.layer))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Honest scope",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "space-y-2 text-sm text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The ρ-calculus reducer implements NEW and COMM over a tuple space. It is not the full rchain-rust evaluator." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The exchange is the QuantumOS 2PC (prepare / prepareReceive / commit / abort) with per-pool conservation." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "QLF certificates apply toSpectralMode to the event’s phase string. They do not formalize RChain." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Sentinel reports observed node-count agreement. Stake-weighted Casper finality is not claimed." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Sovereign Lattice analyses a PBFT-shaped vote set (N=3f+1). It does not claim Casper is PBFT." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "BLS signatures are structural placeholders, not pairing-verified against BLS12-381." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "No live RNode is queried. Every hash is produced by the in-browser compiler." })
					]
				})
			})
		]
	});
}
//#endregion
export { Architecture as component };
