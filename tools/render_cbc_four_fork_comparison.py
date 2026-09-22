#!/usr/bin/env python3
"""Offline HTML renderer for the verified four-Rust-Finalizer differential.

The source-level count-vs-distinct-sender contrast is descriptive only; this
page never treats it as a deployed-network exploit, a best-fork award, or a
protocol-specification decision.
"""
import argparse
from html import escape
import json
from pathlib import Path

from cbc_cross_fork_probe import TARGETS, canonical, sha
from cbc_cross_fork_compare import RESULT_SCHEMA


def render(report):
    if not isinstance(report, dict) or report.get("schema") != RESULT_SCHEMA:
        raise ValueError("Unknown comparative evidence schema")
    expected_digest = report.get("reportSha256")
    body = {k: v for k, v in report.items() if k != "reportSha256"}
    if expected_digest != sha(canonical(body)):
        raise ValueError("Comparison report digest mismatch")
    entries = report.get("targets")
    if not isinstance(entries, list) or len(entries) != len(TARGETS):
        raise ValueError("All four real-source records required")
    entry_by_target = {}
    for entry in entries:
        key = entry.get("target")
        if key not in TARGETS or key in entry_by_target:
            raise ValueError("Invalid/duplicate target")
        repository, expected_sha = TARGETS[key]
        if entry.get("source_sha") != expected_sha or entry.get("repository") != repository:
            raise ValueError("Unsupported source revision")
        if entry.get("exit_code") != 0 or not isinstance(entry.get("rust_observation"), dict):
            raise ValueError("No successful real Rust observation")
        if entry["rust_observation"].get("fixture_sha256") != report.get("inputTransportSha256"):
            raise ValueError("Different input used by target")
        if entry.get("injected_test_sha256") != report.get("identicalInjectedProbeSha256"):
            raise ValueError("Different test source used by target")
        entry_by_target[key] = entry
    rows = []
    fields = (
        ("control_count_gate", "4-sender control: count gate"),
        ("control_sender_count", "4-sender control: distinct next layer"),
        ("control_local_fringe", "4-sender control: reduced local fringe"),
        ("duplicate_count_gate", "3-sender case: count gate"),
        ("duplicate_sender_count", "3-sender case: distinct next layer"),
        ("duplicate_local_fringe", "3-sender case: reduced local fringe"),
    )
    for field, label in fields:
        expected = report.get("observationsByField", {}).get(field)
        actual = {target: entry_by_target[target]["rust_observation"][field]
                  for target in sorted(TARGETS)}
        if expected != actual:
            raise ValueError("Mismatch between summary and source observations")
        diff = len({str(value) for value in actual.values()}) > 1
        if diff != (field in report.get("observedDifferingFields", [])):
            raise ValueError("Invalid source-level differential classification")
        cells = []
        for target in sorted(TARGETS):
            value = actual[target]
            display = str(value).lower() if isinstance(value, bool) else str(value)
            cells.append("<td>" + escape(display) + "</td>")
        rows.append("<tr><th scope='row'>" + escape(label) + "</th>" +
                    "".join(cells) + "<td>" +
                    ("Observed difference" if diff else "Same observed value") +
                    "</td></tr>")
    headers = "".join("<th scope='col'>" + escape(target) + "</th>"
                      for target in sorted(TARGETS))
    source_cards = []
    for target in sorted(TARGETS):
        entry = entry_by_target[target]
        name = escape(entry["repository"])
        sha_value = escape(entry["source_sha"])
        source_cards.append("<li><a href='https://github.com/" + name + "/tree/" +
                            sha_value + "'>" + name + "</a> <code>" + sha_value + "</code></li>")
    witness = report.get("inputTransportSha256")
    if not isinstance(witness, str) or len(witness) != 64:
        raise ValueError("Missing source fixture fingerprint")
    if report.get("protocolPath") != "rchain-block-storage::dag::finalizer":
        raise ValueError("Unexpected protocol path")
    limits = report.get("limitations")
    if not isinstance(limits, list) or len(limits) < 4:
        raise ValueError("Missing scope limitations")
    limits_html = "".join("<li>" + escape(str(limit)) + "</li>" for limit in limits)
    differences = report["observedDifferingFields"]
    comparison = ("No differences in these six observed fields." if not differences
                  else "Different observed fields: " + ", ".join(differences))
    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aria | CBC Four-Implementation Differential</title>
<style>
:root{font-family:system-ui,sans-serif;color-scheme:dark;background:#111625;color:#e9f1ff}
*{box-sizing:border-box}body{max-width:1250px;margin:auto;padding:clamp(14px,3vw,45px)}
h1{font-size:clamp(26px,5vw,46px);line-height:1.15}
p,li{line-height:1.6}.muted{color:#bacde9}code{font-size:11px;color:#bfe4ff;overflow-wrap:anywhere}
a{color:#9dccff}.card{background:#1d2a43;border:1px solid #465570;border-radius:15px;padding:18px;margin:18px 0}
.tablewrap{max-width:100%;overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:760px;text-align:left}
th,td{padding:12px;border-bottom:1px solid #4b5872;vertical-align:top}
th{font-weight:650}td{font-variant-numeric:tabular-nums}
strong{color:#fff}.notice{border-left:4px solid #efc36f;padding-left:15px}
</style></head><body>
<p class="muted">ARI A / SOURCE-LEVEL CBC FINALIZER DIFFERENTIAL</p>
<h1>Four pinned Rust implementations. One reduced CBC fixture.</h1>
<p class="muted">The same temporary Rust test was compiled and executed in four independent checkouts. The input sender shape comes from the read-only M27 research report; the local four-message DAG is intentionally smaller than M27's complete causal graph.</p>
<section class="card"><h2>Observed source-level results</h2>
<p>""" + escape(comparison) + """</p>
<div class="tablewrap"><table><thead><tr><th scope="col">Measured field</th>""" + headers + """<th scope="col">Across sources</th></tr></thead><tbody>""" + "\n".join(rows) + """</tbody></table></div>
<p class="muted">An accepted four-entry count gate with three distinct bonded senders is an observed admission-gate behavior; it does not establish block validation, finality, or an exploit.</p></section>
<section class="card"><h2>Exact code snapshots</h2><ul>""" + "\n".join(source_cards) + """</ul>
<p>Identical input transport SHA-256: <code>""" + escape(witness) + """</code><br>
Identical injected test SHA-256: <code>""" + escape(report["identicalInjectedProbeSha256"]) + """</code><br>
Report SHA-256: <code>""" + escape(expected_digest) + """</code></p></section>
<section class="card notice"><h2>Scope and limitations</h2><ul>""" + limits_html + """</ul></section>
<p class="muted">Inspect the companion JSON report and each source job's raw stdout/stderr, Cargo lockfiles and original/effective Finalizer snapshots. This is an offline view, not live node telemetry.</p>
</body></html>
"""


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--report", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()
    value = json.loads(Path(a.report).read_text(encoding="utf-8"))
    page = render(value)
    target = Path(a.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(page, encoding="utf-8")
    print("Rendered four-implementation offline comparison: " + str(target))


if __name__ == "__main__":
    main()
