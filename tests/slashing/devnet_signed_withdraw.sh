#!/usr/bin/env bash
# Signed network ingress on an actual throwaway RNode, pinned by the workflow checkout.
set -euo pipefail

implementation="${1:?path to rchain-rust checkout}"
evidence="${2:?evidence directory}"
mkdir -p "$evidence"
cd "$implementation"

cleanup() {
  docker logs devnet-bootstrap > "$evidence/node.stdout" 2> "$evidence/node.stderr" || true
  tools/devnet.sh down -v >/dev/null 2>&1 || true
  rm -f examples/aria-signed-withdraw.rho
}
trap cleanup EXIT

cat > examples/aria-signed-withdraw.rho <<'RHO'
new pos(`rho:rchain:pos`), deployerId(`rho:rchain:deployerId`), ret in {
  pos!("withdraw", *deployerId, *ret) |
  for (result <- ret) { @"aria-signed-withdraw-result"!(result) }
}
RHO

tools/devnet.sh build > "$evidence/docker-build.log" 2>&1
tools/devnet.sh up --validators 1 --no-autopropose > "$evidence/devnet-up.log" 2>&1

curl -fsS --retry 5 --retry-delay 2 http://localhost:40403/api/v1/status > "$evidence/status-before.json"
tools/devnet.sh deploy aria-signed-withdraw.rho > "$evidence/deploy-cli.log" 2>&1
deploy_id="$(sed -n 's/.*DeployId is: \([0-9a-f]*\).*/\1/p' "$evidence/deploy-cli.log")"
[[ "$deploy_id" =~ ^[0-9a-f]{32,}$ ]] || { cat "$evidence/deploy-cli.log"; exit 1; }

seen=false
for _ in $(seq 1 80); do
  curl -fsS "http://localhost:40403/api/v1/deploy-status/$deploy_id" > "$evidence/deploy-status.json" || true
  if rg -q 'ProcessedWithSuccess' "$evidence/deploy-status.json"; then seen=true; break; fi
  sleep 2
done
[[ "$seen" == true ]] || { cat "$evidence/deploy-status.json"; exit 1; }

tools/devnet.sh query aria-signed-withdraw-result > "$evidence/withdraw-reply.txt" 2>&1
rg -qi 'true' "$evidence/withdraw-reply.txt"
if rg -qi 'false' "$evidence/withdraw-reply.txt"; then
  cat "$evidence/withdraw-reply.txt"
  exit 1
fi
curl -fsS http://localhost:40403/api/v1/status > "$evidence/status-after.json"
printf 'ARIA_SIGNED_INGRESS_V1|deploy=%s|processed=true|withdraw_reply=true\n' "$deploy_id" | tee "$evidence/observation.txt"
