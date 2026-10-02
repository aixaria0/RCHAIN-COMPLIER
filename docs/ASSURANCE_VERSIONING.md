# Assurance compatibility and release policy

The separately packaged Assurance Engine starts at **0.3.0**. The existing repository/UI package remains at 0.2.0; its scripts and existing evidence schemas are preserved. Pre-1.0 API changes require a minor release and migration notes; fixes within existing behavior use patch releases. Do not relabel incompatible evidence as the same schema version.

Versioned contracts:

| Contract | Version | Compatibility |
| --- | --- | --- |
| Signed events / tasks / membership / replay view | Existing intelligence-lattice */v1 | Original canonical encoding, signature domains and hash roots preserved |
| Workload input | assurance-workload/v1 | Exact field set; workload ID hashes full workload including asserted value |
| Canonical evidence manifest / NDJSON | assurance-evidence-package/v1 | Exact canonical profile and sorted unique events required |
| Review context / report | assurance-review-context/v1 / assurance-report/v1 | Explicit expected pins; status and code semantics documented |
| Workspace configuration | assurance-engine-state/v1 | Exactly three persisted identities, fixed admission policy, explicit integration and plugin digest |

Unknown schemas/profile versions fail closed. Adding optional signed fields also changes the signed contract and requires a new schema. Preserve old readers and converters where practical; conversions generate new provenance and never rewrite the meaning of historical signed bytes. Existing RChain assurance/build/replay/repair schemas remain independently versioned.

SQLite format is the existing metadata/events journal. This release makes no destructive database migrations. Policy mismatch refuses startup. There is no automatic key/membership or plugin change migration: export and retain the old package plus reviewer pins, initialize a separate workspace, validate the new verifier/configuration, and explicitly document lineage. Do not edit the journal or engine.json in place to bypass a refusal. Migrating a custom integration into a release may require rechecking its complete dependency closure.

`npm run pack:assurance` emits an installable tarball; `npm run verify:assurance-package` installs it offline in a clean consumer and checks compiled execution, SDK imports, independent verification, tamper exits and supervisor-kill recovery. CI checks Node 22 and 24 and retains tarballs, SHA-256 checksums and sample/demo evidence. GitHub artifacts on PRs are review outputs, not trusted publisher attestations. Tag-triggered artifacts still require release-owner review and independent digest retention; this workflow does not implicitly publish to npm or replace the repository's existing trusted-build attestation policy.

No publication rights or license changes are implied. Registry publication, distribution permissions, hosted multitenant deployment and a 1.0 support commitment require separate owner decisions.
