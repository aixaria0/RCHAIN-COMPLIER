#!/usr/bin/env python3
"""Render verified four-repository CI records as a read-only offline HTML report."""
import argparse
from html import escape
import json
from pathlib import Path

from four_repo_evidence import SOURCES, verify_seal


def render(bundle, integration=None):
    verify_seal(bundle)
    if bundle.get("schema") != "aria-four-repo-bundle/v1":
        raise ValueError("Unsupported bundle schema")
    records = bundle.get("entries")
    if not isinstance(records, list) or len(records) != len(SOURCES):
        raise ValueError("All four repository records are required")
    seen = set()
    cards = []
    for record in records:
        verify_seal(record)
        component = record.get("component")
        if component not in SOURCES or component in seen:
            raise ValueError("Unknown or duplicate component")
        seen.add(component)
        spec = SOURCES[component]
        if record.get("repository") != spec["repository"] or record.get("source_sha") != spec["sha"]:
            raise ValueError("Wrong source revision")
        if record.get("exit_code") != 0:
            raise ValueError("Failed source-test cannot be rendered as a PASS")
        if record.get("live_network") is not False or record.get("interoperability_verified") is not False:
            raise ValueError("Evidence boundary must remain explicit")
        label = escape(component.upper())
        repo = escape(record["repository"])
        sha = escape(record["source_sha"])
        scope = escape(record["scope"])
        stdout_hash = escape(record["stdout_sha256"])
        stderr_hash = escape(record["stderr_sha256"])
        lock = record.get("dependency_lockfile")
        lock_row = ""
        if lock is not None:
            marker = "updated during Cargo resolution" if lock["modified_by_cargo"] else "unchanged"
            lock_row = ("<p><strong>Dependency graph:</strong> " + escape(marker) +
                        "<br><code>effective Cargo.lock SHA-256: " +
                        escape(lock["effective_sha256"]) + "</code></p>")
        cards.append(
            '<article class="card"><header><h2>' + label +
            '</h2><span class="pass">SOURCE TEST PASS</span></header>' +
            '<p><a href="https://github.com/' + repo + '/tree/' + sha +
            '">' + repo + '</a></p>' +
            '<p class="scope">' + scope + '</p>' +
            '<p><strong>Exact revision:</strong><br><code>' + sha + '</code></p>' +
            '<p><strong>Stdout digest:</strong><br><code>' + stdout_hash + '</code></p>' +
            '<p><strong>Stderr digest:</strong><br><code>' + stderr_hash + '</code></p>' +
            lock_row + '</article>'
        )
    if seen != set(SOURCES) or bundle.get("components_passed") != len(SOURCES):
        raise ValueError("Incomplete four-repo run")
    disclaimer = "".join("<li>" + escape(note) + "</li>" for note in bundle.get("limits", []))
    digest = escape(bundle["record_sha256"])
    integration_html = ""
    if integration is not None:
        if (integration.get("schema") != "aria-verified-four-repo-evidence/v1"
                or integration.get("sourceTestsPassed") != 4
                or integration.get("externalWitnessConsumers") != 3
                or integration.get("liveNetwork") is not False
                or integration.get("independentlyVerifiedCasperFinality") is not False
                or integration.get("sourceRevisions", {}).get("cbc") != SOURCES["cbc"]["sha"]
                or integration.get("sourceRevisions", {}).get("sentinel") != SOURCES["sentinel"]["sha"]
                or integration.get("sourceRevisions", {}).get("lattice") != SOURCES["lattice"]["sha"]):
            raise ValueError("Invalid or elevated cross-repository evidence")
        witness_digest = integration.get("witnessTransportSha256")
        if not isinstance(witness_digest, str) or len(witness_digest) != 64 or not all(
                char in "0123456789abcdef" for char in witness_digest):
            raise ValueError("Invalid witness transport digest")
        ids = integration.get("selectedM27MessageIds")
        if not isinstance(ids, list) or len(ids) != 4 or any(
                item not in ("a3", "b3", "c3", "d3") for item in ids):
            raise ValueError("Missing selected source-reported M27 message identities")
        unique = len(set(ids))
        if (integration.get("selectedM27UniqueMessageIds") != unique
                or integration.get("selectedM27FourDistinctIdsRepresentable") is not (unique == 4)
                or integration.get("selectedM27RealFinalizerFinalityIndependentlyReplayed") is not False):
            raise ValueError("M27 identity gap or independent-finality boundary mismatched")
        identity_note = (
            "SELECTED M27 MODEL TUPLE NOT DIRECTLY REPLAYABLE AS FOUR UNIQUE MESSAGE IDS"
            if unique < 4 else "M27 has four unique IDs; full replay still unverified"
        )
        boundary = escape(integration["claimBoundary"])
        integration_html = (
            '<section class="card"><h2>Verified four-source evidence handoff</h2>'
            '<p><span class="pass">SOURCE-LEVEL EVIDENCE LINKED</span></p>'
            '<p>One real bounded CBC research report was consumed by '
            'RLSenti and Sentinel; Sovereign-Lattice ran a separately '
            'labelled PBFT control correlated by the same witness digest.</p>'
            '<p><strong>Witness SHA-256:</strong><br><code>'
            + escape(witness_digest) + '</code></p>'
            '<p><strong>First identity boundary:</strong> ' + escape(identity_note) +
            ' — original tuple: <code>' + escape(", ".join(ids)) +
            '</code>; unique message IDs: ' + str(unique) + '.</p>' +
            '<p><strong>Claim boundary:</strong> ' + boundary + '</p></section>'
        )
    return ("""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aria | Four-source Evidence Plane</title>
<style>
:root{font-family:system-ui,sans-serif;color-scheme:dark;background:#101421;color:#edf3ff}
*{box-sizing:border-box}body{margin:auto;max-width:1250px;padding:clamp(16px,4vw,46px)}
h1{font-size:clamp(29px,5vw,52px);line-height:1.08;margin-bottom:10px}
h2{font-size:20px}.lead{color:#bed1f5;max-width:770px;line-height:1.65}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;margin:27px 0}
.card{background:#1b263b;border:1px solid #45536e;border-radius:16px;padding:20px;overflow-wrap:anywhere}
.card header{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
.pass{font-size:11px;background:#134631;color:#c6ffe3;padding:7px;border-radius:30px;font-weight:800}
.scope{color:#c4d2e8;min-height:44px}
a{color:#9dc7ff}code{font-size:12px;color:#c4e0ff}
aside{background:#222b3e;border-left:4px solid #f1c674;padding:18px;border-radius:8px}
li{padding-bottom:8px;line-height:1.45}.meta{font-size:12px;color:#b6c5db;overflow-wrap:anywhere}
</style></head><body>
<p class="meta">RCHAIN-COMPLIER / FOUR-SOURCE EVIDENCE / PINNED-COMMIT CI</p>
<h1>Four real repositories. One evidence bundle.</h1>
<p class="lead">This offline report is rendered from four successful source-level test records. It records what code ran and what its tests actually established. No live-node or cross-protocol correctness is inferred.</p>
<div class="grid">""" + "\n".join(cards) + """</div>""" + integration_html + """
<aside><h2>Evidence boundary</h2><ul>""" + disclaimer + """</ul></aside>
<p class="meta">Bundle SHA-256: <code>""" + digest +
"""</code><br>Source: GitHub Actions artifact; inspect the JSON and original logs alongside this page.</p>
</body></html>
""")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--integration", help="Validated four-source integration JSON")
    args = parser.parse_args()
    bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
    integration = (json.loads(Path(args.integration).read_text(encoding="utf-8"))
                   if args.integration else None)
    html = render(bundle, integration)
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    print("Rendered four-repository evidence dashboard: " + str(path))


if __name__ == "__main__":
    main()
