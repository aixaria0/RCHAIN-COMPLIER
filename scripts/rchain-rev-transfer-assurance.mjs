#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { verifyRevTransferAssurance } from "../src/lib/assurance/rchain-rev-transfer-v1.ts";
const [evidence, policy] = process.argv.slice(2);
if (!evidence || !policy) throw new Error("Usage: node scripts/rchain-rev-transfer-assurance.mjs EVIDENCE.json EXTERNAL_POLICY.json");
const verdict = await verifyRevTransferAssurance(JSON.parse(readFileSync(evidence,"utf8")),JSON.parse(readFileSync(policy,"utf8")));
process.stdout.write(JSON.stringify(verdict,null,2)+"\n");
process.exitCode = verdict.status === "PASS" ? 0 : verdict.status === "BLOCKED" ? 2 : 1;
