import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { repairCasperDuplicateMinimumSenderCoverage } from "../src/lib/cbc/casper-repair-adapter.ts";

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Object.is(value, -0) ? "0" : String(value);
  if (typeof value === "object") {
    const r = value as Record<string, unknown>;
    return `{${Object.keys(r).sort().map(k => `${JSON.stringify(k)}:${canonical(r[k])}`).join(",")}}`;
  }
  throw new Error("unsupported canonical value");
}
const digest=(v:unknown)=>`sha256:${createHash("sha256").update(canonical(v)).digest("hex")}`;

const bindingPath=process.argv[2], receiptPath=process.argv[3], outputPath=process.argv[4];
if(!bindingPath||!receiptPath||!outputPath) throw new Error("usage: emit-repair-propagation.ts <binding> <receipt> <output>");
const binding=JSON.parse(await readFile(bindingPath,"utf8"));
const receipt=JSON.parse(await readFile(receiptPath,"utf8"));
const compiled=repairCasperDuplicateMinimumSenderCoverage();
if(compiled.status!=="COMPILED"||compiled.artifact?.outcome!=="REPAIR_FOUND") throw new Error("repair compiler did not produce REPAIR_FOUND");
if(binding.nativeReplayVerified!==true) throw new Error("native binding is not verified");
if(binding.repairArtifactDigest!==digest(compiled.artifact)) throw new Error("binding does not match current repair artifact");
if(binding.nativeReceiptDigest!==digest(receipt)) throw new Error("binding does not match native receipt");

const envelope={
 schema:"causal-assurance-repair-propagation/v1",
 repairProblemId:compiled.artifact.repairProblemId,
 repairArtifactDigest:binding.repairArtifactDigest,
 nativeReceiptDigest:binding.nativeReceiptDigest,
 nativeBindingDigest:digest(binding),
 upstreamRepository:binding.upstreamRepository,
 upstreamCommit:binding.upstreamCommit,
 repairAction:binding.repairAction,
 nativeReplayVerified:true,
 claimBoundary:"Bound to the compiler-selected bounded repair and pinned native Rust replay. This envelope transports evidence identity; it does not establish global protocol safety."
};
await writeFile(outputPath,JSON.stringify(envelope,null,2)+"\n");
process.stdout.write(JSON.stringify(envelope,null,2)+"\n");
