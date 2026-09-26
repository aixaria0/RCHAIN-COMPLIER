#!/usr/bin/env python3
"""Ordinary two-validator sync/finality gate for the pinned genesis replay fix."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import time
import urllib.error
import urllib.request

PIN = "11b2200dcca580f2c00246302238840dcd4f08f6"
PUBKEYS = (
    "04f700a417754b775d95421973bdbdadb2d23c8a5af46f1829b1431f5c136e549e8a0d61aa0c793f1a614f8e437711c7758473c6ceb0859ac7e9e07911ca66b5c4",
    "04dbe32c2062240a4ba0bcad01d7edd98c78b51c77765d5e1e5e9fa3743d2f12a1f82f42cd7dc4f41445979117d790f23e9b3d08d0aa06d527c236172043e747fc",
)
STAKES = (80, 20)


def require(ok, message):
    if not ok:
        raise ValueError(message)


def block_info(response):
    require(isinstance(response, dict), "block response must be an object")
    info = response.get("blockInfo")
    require(isinstance(info, dict), "missing blockInfo")
    for field in ("blockHash", "postStateHash"):
        require(isinstance(info.get(field), str) and
                re.fullmatch(r"[0-9a-f]{64}", info[field]), f"invalid {field}")
    number = info.get("blockNumber")
    require(type(number) is int and number >= 0, "invalid blockNumber")
    require(info.get("shardId") == "/root", "unexpected shard")
    return info


def common_finality(left, right, baseline, confirmations):
    a, b = block_info(left), block_info(right)
    require(a["blockNumber"] > baseline, "finality did not advance")
    for field in ("blockNumber", "blockHash", "postStateHash"):
        require(a[field] == b[field], f"finalized {field} differs")
    require(len(confirmations) == 2 and all(x is True for x in confirmations),
            "both nodes must explicitly confirm finalization")
    return {key: a[key] for key in ("blockNumber", "blockHash", "postStateHash")}


def genesis_info(blocks):
    require(isinstance(blocks, list) and len(blocks) == 1,
            "exactly one indexed genesis block is required")
    info = block_info({"blockInfo": blocks[0]})
    require(info["blockNumber"] == 0, "expected the genesis height")
    bonds = info.get("bonds")
    require(isinstance(bonds, list) and len(bonds) == len(PUBKEYS),
            "unexpected genesis bond count")
    require({b["validator"]: b["stake"] for b in bonds} == dict(zip(PUBKEYS, STAKES)),
            "genesis bonds do not match test configuration")
    return info


def prepare_launcher(source, prefix, genesis):
    """Adapt environment only. Rust, contracts and replay code remain unchanged."""
    replacements = [
        ('NETWORK="devnet"', f'NETWORK="{prefix}"'),
        ('BOOTSTRAP="devnet-bootstrap"', f'BOOTSTRAP="{prefix}-bootstrap"'),
        ('PREFIX="devnet"', f'PREFIX="{prefix}"'),
        ('    | awk -F\'=\' \'{print $NF}\'\n',
         '    | awk -F\'=\' \'{print $NF}\' | tr -d \'[:space:]\'\n'),
        ('  genesis_dir="$(mktemp -d)"', f'  genesis_dir={shlex.quote(str(genesis))}'),
        ('  genesis_files "$genesis_dir" "$n"\n',
         '  genesis_files "$genesis_dir" "$n"\n'
         '  chmod 755 "$genesis_dir"\n'
         '  chmod 644 "$genesis_dir"/bonds.txt "$genesis_dir"/wallets.txt\n'),
        ('    echo "${VALIDATOR_PUB[$i]} 100" >> "$dir/bonds.txt"',
         '    if (( i == 0 )); then stake=80; else stake=20; fi\n'
         '    echo "${VALIDATOR_PUB[$i]} $stake" >> "$dir/bonds.txt"'),
        ('-p ${grpc_host}:40401 -p ${http_host}:40403',
         '-p 127.0.0.1:${grpc_host}:40401 -p 127.0.0.1:${http_host}:40403'),
        ('-p ${admin_host}:40405', '-p 127.0.0.1:${admin_host}:40405'),
    ]
    for old, new in replacements:
        require(source.count(old) == 1, f"launcher anchor changed: {old}")
        source = source.replace(old, new)
    return source


class Runner:
    def __init__(self, implementation, evidence):
        self.root = implementation.resolve()
        self.out = evidence.resolve()
        self.out.mkdir(parents=True, exist_ok=True)
        require(not (self.out / "result.json").exists(), "use a fresh evidence directory")
        self.prefix = f"cbc-sync-{os.getpid()}"
        self.nodes = [f"{self.prefix}-bootstrap", f"{self.prefix}-validator-1"]
        self.started = False
        self.original = None
        self.counter = 0
        self.result = {"schemaVersion": 1, "upstreamCommit": PIN, "status": "RUNNING",
                       "phase": "PREFLIGHT", "stakes": list(STAKES), "proposals": [],
                       "runnerCommit": os.environ.get("GITHUB_SHA"),
                       "scope": "ordinary devnet sync and finality; no PoS lifecycle operations"}

    def save(self, name, value):
        (self.out / name).write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")

    def phase(self, name):
        self.result["phase"] = name
        self.save("result.json", self.result)
        print(name, flush=True)

    def command(self, label, argv, timeout=30, check=True):
        with (self.out / f"{label}.stdout").open("w") as stdout, \
                (self.out / f"{label}.stderr").open("w") as stderr:
            done = subprocess.run(argv, cwd=self.root, stdout=stdout, stderr=stderr,
                                  timeout=timeout, check=False)
        self.save(f"{label}.command.json", {"argv": argv, "exitCode": done.returncode})
        if check:
            require(done.returncode == 0, f"{label} exited {done.returncode}; see command logs")
        return (self.out / f"{label}.stdout").read_text()

    def http(self, node, path, method="GET", admin=False):
        port = (40405 if admin else 40403) + node * 1000
        url = f"http://127.0.0.1:{port}{path}"
        self.counter += 1
        record = {"url": url, "method": method}
        try:
            request = urllib.request.Request(url, method=method)
            with urllib.request.urlopen(request, timeout=30 if admin else 5) as response:
                record.update(status=response.status, body=response.read().decode())
            return json.loads(record["body"])
        except Exception as exc:
            record["error"] = str(exc)
            if isinstance(exc, urllib.error.HTTPError):
                record.update(status=exc.code, body=exc.read().decode(errors="replace"))
            raise
        finally:
            self.save(f"http-{self.counter:04d}.json", record)

    def wait(self, label, fn, seconds=90):
        deadline, last = time.monotonic() + seconds, "no observation"
        while time.monotonic() < deadline:
            try:
                return fn()
            except (ValueError, KeyError, urllib.error.URLError, ConnectionError, TimeoutError) as exc:
                last = str(exc)
                time.sleep(2)
        raise ValueError(f"{label} timed out: {last}")

    def ready(self):
        statuses = [self.http(i, "/api/v1/status") for i in range(2)]
        for status in statuses:
            require(status.get("shardId") == "/root", "wrong shard")
            require(type(status.get("peers")) is int and status["peers"] >= 1,
                    "both nodes must have a connected peer")
        return statuses

    def synced_genesis(self):
        # A fresh DAG need not expose a finalized fringe yet. Check genesis
        # membership via the height index, then let both validators make blocks.
        infos = [genesis_info(self.http(i, "/api/blocks/0/0")) for i in range(2)]
        require(infos[0] == infos[1], "indexed genesis metadata differs")
        return infos

    def run(self):
        actual = self.command("source-head", ["git", "rev-parse", "HEAD"]).strip()
        require(actual == PIN, "upstream pin mismatch")
        require(not self.command("source-clean", ["git", "status", "--porcelain"]).strip(),
                "upstream must be clean before launcher adaptation")
        self.command("image", ["docker", "image", "inspect", os.environ["RNODE_IMAGE"]])
        self.original = (self.root / "tools/devnet.sh").read_text()
        self.result["originalLauncherSha256"] = hashlib.sha256(self.original.encode()).hexdigest()
        genesis = self.out / "genesis"
        genesis.mkdir()
        launcher = prepare_launcher(self.original, self.prefix, genesis)
        (self.root / "tools/devnet.sh").write_text(launcher)
        (self.out / "launcher.sh").write_text(launcher)
        self.result["effectiveLauncherSha256"] = hashlib.sha256(launcher.encode()).hexdigest()
        self.command("launcher-syntax", ["bash", "-n", "tools/devnet.sh"])
        self.command("launcher-diff", ["git", "diff", "--", "tools/devnet.sh"])
        self.phase("BOOT")
        self.started = True
        self.command("boot", ["bash", "tools/devnet.sh", "up", "--validators", "2",
                              "--no-autopropose", "--no-propose-on-deploy"], timeout=240)
        self.phase("PEER_SYNC")
        self.result["initialStatus"] = self.wait("peer connectivity", self.ready)
        infos = self.wait("indexed genesis on both nodes", self.synced_genesis)
        baseline = infos[0]["blockNumber"]
        self.save("initial-genesis.json", infos)
        self.result["genesisHeight"] = baseline
        self.phase("BLOCK_EXCHANGE")
        # Keep proposals sequential and wait for the exact block to reach the peer.
        # Dev-mode's upstream signed Nil keepalive supplies ordinary, funded deploys.
        for round_number in range(16):
            for i in range(2):
                response = self.http(i, "/api/propose", method="POST", admin=True)
                match = re.fullmatch(r"Success! Block ([0-9a-f]{64}) created and added\.",
                                     response if isinstance(response, str) else "")
                require(match is not None, f"node {i} proposal failed: {response}")
                block_hash = match.group(1)
                block = self.http(i, f"/api/block/{block_hash}")
                own = block_info(block)
                require(own["blockHash"] == block_hash and own.get("sender") == PUBKEYS[i],
                        "unexpected proposed block identity")

                def received():
                    peer = block_info(self.http(1 - i, f"/api/block/{block_hash}"))
                    require(peer == own, "peer block metadata differs")
                    return peer

                self.wait(f"node {1-i} receives {block_hash}", received, seconds=60)
                self.result["proposals"].append({"node": i, "round": round_number,
                                               "height": own["blockNumber"], "hash": block_hash})
                self.save("result.json", self.result)
            # Require two proposals by each validator before accepting success. This
            # exercises a joining validator after its first local block as well.
            if round_number >= 1:
                self.phase("FINALITY")
                try:
                    finalized = [self.http(i, "/api/last-finalized-block") for i in range(2)]
                    h = block_info(finalized[0])["blockHash"]
                    confirmations = [self.http(i, f"/api/is-finalized/{h}") for i in range(2)]
                    witness = common_finality(*finalized, baseline, confirmations)
                except (ValueError, KeyError, urllib.error.URLError, ConnectionError, TimeoutError) as exc:
                    self.result["lastFinalityObservation"] = str(exc)
                    continue
                self.result["finalStatus"] = self.ready()
                self.result["finalized"] = witness
                self.save("finalized-blocks.json", finalized)
                self.result.update(status="PASS", phase="COMPLETE")
                return
        raise ValueError("common finality not observed after 32 successful proposals")

    def cleanup(self):
        if self.started:
            for node in self.nodes:
                for label, argv in ((f"{node}-logs", ["docker", "logs", node]),
                                    (f"{node}-inspect", ["docker", "inspect", node])):
                    try:
                        self.command(label, argv, check=False)
                    except Exception as exc:
                        self.result.setdefault("cleanupErrors", []).append(str(exc))
            try:
                self.command("cleanup", ["bash", "tools/devnet.sh", "down", "-v"],
                             timeout=60, check=False)
            except Exception as exc:
                self.result.setdefault("cleanupErrors", []).append(str(exc))
        if self.original is not None:
            (self.root / "tools/devnet.sh").write_text(self.original)
        self.save("result.json", self.result)
        files = {str(p.relative_to(self.out)): hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in sorted(self.out.rglob("*")) if p.is_file() and p.name != "sha256.json"}
        self.save("sha256.json", files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("implementation", type=Path)
    parser.add_argument("evidence", type=Path)
    args = parser.parse_args()
    runner = Runner(args.implementation, args.evidence)

    def stop(signum, frame):
        raise RuntimeError(f"run interrupted or overall time budget exhausted (signal {signum})")

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGALRM, stop)
    signal.alarm(12 * 60)
    try:
        runner.run()
    except Exception as exc:
        runner.result.update(status="FAIL", error=str(exc))
    finally:
        signal.alarm(0)
        runner.cleanup()
    print(json.dumps(runner.result, indent=2), flush=True)
    return 0 if runner.result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
