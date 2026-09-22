#!/usr/bin/env python3
"""Reproducible GitHub revision-drift inventory. Not a consensus correctness test."""
import argparse
import hashlib
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

DEFAULT_FORKS = ("Shplarggle/rchain-rust", "nzpr/rchain-rust", "Bill-Kunj/rchain-rust")
DEFAULT_UPSTREAM = "rchain-community/rchain-rust"
API = "https://api.github.com"


def get_json(path):
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "cbc-fork-drift-evidence/1"}
    if token:
        headers["Authorization"] = "Bearer " + token
    with urlopen(Request(API + path, headers=headers), timeout=20) as response:
        return json.load(response)


def repository_name(name):
    parts = name.split("/")
    if len(parts) != 2 or any(not p or not all(c.isalnum() or c in "-_." for c in p) for p in parts):
        raise ValueError("Expected GitHub owner/repository: " + name)
    return name


def compare_one(upstream, fork, ref="dev", fetch=get_json):
    upstream = repository_name(upstream)
    fork = repository_name(fork)
    if fork == upstream:
        raise ValueError("A fork cannot be its own upstream")
    if not ref or not all(c.isalnum() or c in "._-" for c in ref):
        raise ValueError("Invalid branch name")
    upstream_owner, _ = upstream.split("/")
    owner, _ = fork.split("/")
    base = fetch("/repos/" + upstream + "/commits/" + quote(ref, safe=""))
    head = fetch("/repos/" + fork + "/commits/" + quote(ref, safe=""))
    comparison = fetch("/repos/" + upstream + "/compare/" + quote(ref, safe="") + "..." +
                       quote(owner, safe="") + ":" + quote(ref, safe=""))
    ahead = comparison["ahead_by"]
    behind = comparison["behind_by"]
    # compare(base=upstream, head=fork): ahead = fork-only, behind = upstream-only.
    return {
        "fork": fork,
        "upstream": upstream,
        "branch": ref,
        "upstream_sha": base["sha"],
        "fork_sha": head["sha"],
        "fork_only_commits": ahead,
        "upstream_only_commits": behind,
        "relationship": comparison["status"],
        "merge_base_sha": comparison["merge_base_commit"]["sha"],
        "compare_url": comparison["html_url"],
        "note": "Revision ancestry only; this is not a performance, security or correctness verdict.",
    }


def build_report(upstream=DEFAULT_UPSTREAM, forks=DEFAULT_FORKS, ref="dev", fetch=get_json):
    if len(set(forks)) != len(forks):
        raise ValueError("Duplicate fork")
    entries = [compare_one(upstream, fork, ref, fetch) for fork in sorted(forks)]
    content = {"schema": "cbc-fork-drift/v1", "entries": entries,
               "limits": ["GitHub ancestry comparison, not a code-quality ranking.",
                          "No live network, benchmark, exploit, or finality claim.",
                          "A later conformance run must pin all revisions and use identical fixtures."]}
    canonical = json.dumps(content, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    content["sha256"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return content


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream", default=DEFAULT_UPSTREAM)
    parser.add_argument("--fork", action="append", dest="forks", help="owner/repo; repeatable")
    parser.add_argument("--branch", default="dev")
    parser.add_argument("--output", help="Write JSON to this file as well as stdout")
    args = parser.parse_args(argv)
    try:
        report = build_report(args.upstream, args.forks or DEFAULT_FORKS, args.branch)
        body = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
        if args.output:
            with open(args.output, "w", encoding="utf-8") as target:
                target.write(body)
        sys.stdout.write(body)
        return 0
    except (ValueError, KeyError, HTTPError, URLError, TimeoutError) as error:
        print("drift inventory failed: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
