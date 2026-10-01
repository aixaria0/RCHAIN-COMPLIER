# Offline review of an Assurance Package

A reviewer can now verify a serialized `rchain-assurance-package/v1` in a fresh
Node process, using the same verifier as the application. Node 22 with type
stripping (or Node 24) is required.

Obtain the expected reviewer's `sha256:` public-key fingerprint through your
trusted review process. Do not copy the expected fingerprint from the untrusted
package: the explicit pin is the trust anchor for its signer and embedded policy.

From the repository root:

```sh
node --experimental-strip-types scripts/assurance-verify.ts \
  --package /path/to/assurance-package.json \
  --reviewer-key-id sha256:<64-lowercase-hex-characters> \
  > assurance-verification.json
```

Alternatively use `npm run --silent assurance:verify --` with the same arguments.
The command writes one JSON report to stdout and performs no network requests.

| Exit code | Meaning |
| --- | --- |
| 0 | The existing package verifier accepted signatures, certificate policy and bound evidence. |
| 1 | Verification completed and rejected the package. |
| 2 | Arguments, file, JSON, or package structure prevented verification. |

The report is a local verification result, not a new signed attestation. It does
not perform a fresh network observation, repeat a native replay, execute a
restore, or establish present network health. Time-related checks use the
certificate's declared context as implemented by the package verifier.

## Four-repository context

Compiler composes/verifies evidence; Sentinel supplies signed observations;
rlsenti provides the workbench; Sovereign-Lattice provides an independent PBFT
control path. The earlier cross-repository witness adapters are tracked in
Compiler #17, rlsenti #1 and Sovereign-Lattice #1. The latter's control receipt
explicitly does not verify a PBFT certificate or Casper finality. The portable
reviewer signature here is Ed25519, not a Sovereign-Lattice threshold certificate.
This CLI consumes the current Compiler #21 package contract. It does not claim
that all four repositories have emitted a production assurance package together.

## Validation

The package integration test serializes independently signed test evidence and
runs this command as a child process. It checks acceptance of the intact test
package, rejection of a wrong reviewer pin and edited certificate, and nonzero
exit for malformed input, missing files and invalid pin syntax. These are test
fixtures, not staging or production observations.
