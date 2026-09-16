import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as FieldRow, c as Panel, h as shortHex, i as Expandable, l as SeverityTag, n as MobileNav, p as useWorkbench, r as EvidenceList, u as StatusTag } from "./router-Dksdxy5P.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/evidence-DDB_a4Dg.js
var import_jsx_runtime = require_jsx_runtime();
function Evidence() {
	const { reality } = useWorkbench();
	const c = reality.cross;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Cross-node report",
					subtitle: "Sentinel observation — not stake-weighted finality",
					right: c ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: c.status }) : null,
					children: c ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "reachable",
							value: `${c.reachableCount} / ${c.targetCount}`,
							source: "CrossNodeReport",
							field: "reachable_count"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "agreeing",
							value: String(c.agreeingNodes),
							source: "CrossNodeReport",
							field: "agreeing_nodes"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "ratio",
							value: c.agreementRatio.toFixed(2),
							source: "CrossNodeReport",
							field: "agreement_ratio"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "quorum observed",
							value: String(c.quorumObserved),
							source: "CrossNodeReport",
							field: "quorum_observed"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "common hash",
							value: c.commonHash ? shortHex(c.commonHash) : "UNAVAILABLE",
							unavailable: !c.commonHash
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-xs text-muted",
							children: c.verificationBasis
						})
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "UNAVAILABLE — no block, no observations."
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Sovereign Lattice",
					subtitle: "Independent PBFT-shaped certificate analysis",
					right: reality.lattice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: reality.lattice.status }) : null,
					children: reality.lattice ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "N / f / Q",
							value: `${reality.lattice.n} / ${reality.lattice.f} / ${reality.lattice.quorum}`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "primary",
							value: reality.lattice.primary
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "prepared",
							value: `${reality.lattice.preparedCount} · cert ${reality.lattice.preparedCertificate}`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "committed",
							value: `${reality.lattice.committedCount} · cert ${reality.lattice.committedCertificate}`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
							label: "conflicting prepare",
							value: String(reality.lattice.conflictingPrepare)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-xs text-muted",
							children: reality.lattice.verificationBasis
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-subtle",
							children: reality.lattice.notClaimed
						})
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "UNAVAILABLE — no digest to vote on."
					})
				})]
			}),
			reality.lattice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "PBFT votes",
				subtitle: "PrePrepare → Prepare → Commit · conflicting digests dropped",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[40rem] text-left text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "font-mono text-micro tracking-label text-muted",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "REPLICA"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "PHASE"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "DIGEST"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "ACCEPTED"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2",
										children: "REASON"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: reality.lattice.votes.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs",
									children: v.replica
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs text-primary",
									children: v.phase
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs",
									children: shortHex(v.digest)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3",
									children: v.accepted ? "yes" : "no"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: v.rejectReason ?? "—"
								})
							]
						}, i)) })]
					})
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Observations",
				children: reality.observations.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[44rem] text-left text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "font-mono text-micro tracking-label text-muted",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "NODE"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "REACHABLE"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "HEIGHT"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "HASH"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "PROPOSER"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2",
										children: "JUSTIFICATION"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: reality.observations.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs",
									children: o.nodeId
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3",
									children: o.reachable ? "true" : "false"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 tabular-nums",
									children: o.lastFinalizedBlockNumber
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs",
									children: shortHex(o.blockHash)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs",
									children: o.proposer
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2",
									children: o.justificationPresent ? o.justificationCount : "absent"
								})
							]
						}, o.nodeId)) })]
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "UNAVAILABLE"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Invariants",
				subtitle: "PASS / WARN / FAIL with an evidence trail. Not Lean proofs.",
				children: reality.invariants.map((inv) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Expandable, {
					header: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xxs text-primary",
								children: inv.id
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm",
								children: inv.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: inv.status }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeverityTag, { severity: inv.severity })
						]
					}),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs text-muted",
						children: inv.detail
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EvidenceList, { evidence: inv.evidence })]
				}, inv.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Verification matrix",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[40rem] text-left text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "font-mono text-micro tracking-label text-muted",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "CHECK"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "STATUS"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "SEV"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 pr-3",
										children: "SOURCE"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2",
										children: "MESSAGE"
									})
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: reality.checks.map((ch) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50 align-top",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3",
									children: ch.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusTag, { status: ch.status })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeverityTag, { severity: ch.severity })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-mono text-xxs text-evidence",
									children: ch.source
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: ch.message
								})
							]
						}, ch.id)) })]
					})
				})
			}),
			reality.casper ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "Casper evidence inventory",
				subtitle: "Recognized protocol fields — not authenticated proof",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "status",
						value: reality.casper.status
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "bonds",
						value: String(reality.casper.bondCount)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "observed stake",
						value: String(reality.casper.totalObservedStake)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "duplicates",
						value: String(reality.casper.duplicateValidatorCount)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldRow, {
						label: "fields",
						value: reality.casper.recognizedFields.join(", ")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-xs text-muted",
						children: reality.casper.verificationBasis
					})
				]
			}) : null
		]
	});
}
//#endregion
export { Evidence as component };
