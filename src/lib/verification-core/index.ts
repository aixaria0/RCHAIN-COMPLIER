/**
 * Stable protocol-agnostic verification entrypoint.
 *
 * Keep this barrel free of domain-specific adapters.
 */
export * from "../compiler/lexicographic-possibility.ts";
export * from "../compiler/verification-compiler.ts";
export * from "../compiler/finite-state-verifier.ts";
export * from "../compiler/quantitative-what-if.ts";
