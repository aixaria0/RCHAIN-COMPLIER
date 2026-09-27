#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import {
  createSignedBuildProvenanceAttestation,
  createSignedNativeReplayAttestation,
} from "../src/lib/compiler/attestation-producer-node.ts";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) throw new Error(`unexpected argument: ${item}`);
    const name = item.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function required(options, name) {
  const value = options[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

async function readSeed(options) {
  const keyFile = options["key-file"];
  const envSeed = process.env.ASSURANCE_ED25519_PRIVATE_KEY_HEX;
  if (keyFile && envSeed) {
    throw new Error("provide the Ed25519 seed through --key-file OR ASSURANCE_ED25519_PRIVATE_KEY_HEX, not both");
  }
  const value = keyFile
    ? (await readFile(keyFile, "utf8")).trim()
    : envSeed?.trim();
  if (!value) {
    throw new Error("no signing key configured; use --key-file (preferred) or ASSURANCE_ED25519_PRIVATE_KEY_HEX");
  }
  return value;
}

async function writeEnvelope(path, envelope) {
  await writeFile(path, JSON.stringify(envelope, null, 2) + "\n", {
    mode: 0o600,
  });
  process.stdout.write(
    JSON.stringify({
      output: path,
      key_id: envelope.signature.key_id,
      payload_sha256: envelope.payload_sha256,
    }) + "\n",
  );
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const privateSeedHex = await readSeed(options);

  if (command === "build") {
    const envelope = await createSignedBuildProvenanceAttestation({
      repository: required(options, "repository"),
      commit: required(options, "commit"),
      artifactPath: required(options, "artifact"),
      subjectName: options["subject-name"],
      builderId: required(options, "builder-id"),
      buildType: options["build-type"],
      invocationId: options["invocation-id"],
      startedOn: options["started-on"],
      finishedOn: options["finished-on"],
      privateSeedHex,
    });
    await writeEnvelope(required(options, "output"), envelope);
    return;
  }

  if (command === "replay") {
    const payload = JSON.parse(
      await readFile(required(options, "payload"), "utf8"),
    );
    const envelope = createSignedNativeReplayAttestation({
      payload,
      privateSeedHex,
    });
    await writeEnvelope(required(options, "output"), envelope);
    return;
  }

  throw new Error(
    "usage: assurance-attestation-producer.ts <build|replay> [options]",
  );
}

main().catch((error) => {
  process.stderr.write(
    `assurance attestation producer failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
