import { readFile } from "node:fs/promises";
import { verifyAssurancePackage } from "../src/lib/compiler/assurance-package.ts";

// This command performs offline verification. The reviewer pin must be supplied
// separately by the operator; never derive trust from the package itself.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--package" || args[2] !== "--reviewer-key-id" ||
      !/^sha256:[0-9a-f]{64}$/.test(args[3])) {
    throw new Error("Usage: assurance-verify.ts --package FILE --reviewer-key-id sha256:<64 lowercase hex characters>");
  }
  const envelope = JSON.parse(await readFile(args[1], "utf8"));
  const verification = await verifyAssurancePackage(envelope, args[3]);
  process.stdout.write(`${JSON.stringify({
    schema: "rchain-assurance-verification-report/v1",
    verificationMode: "OFFLINE_PACKAGE",
    expectedReviewerKeyId: args[3],
    ...verification,
  }, null, 2)}\n`);
  process.exitCode = verification.valid ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stdout.write(`${JSON.stringify({
    schema: "rchain-assurance-verification-report/v1",
    verificationMode: "OFFLINE_PACKAGE",
    valid: false,
    reason: error instanceof Error ? error.message : String(error),
  }, null, 2)}\n`);
  process.exitCode = 2;
});
