// Source-pinned, fail-closed slashing decision-model controls.
// This is NOT a Rust execution or deployed-network security finding.
import test from "node:test";
import assert from "node:assert/strict";

export const SOURCE_PIN = "9f06172567d28e306a8649f4d85ba6d9c1cf2c75";

export function selectSlashCandidates({ justifications, bonds }) {
  const offenders = new Set(justifications.filter(m => m.validationFailed).map(m => m.sender));
  return [...offenders].filter(sender => (bonds[sender] ?? 0) > 0).sort();
}

export function applySlash(state, sender) {
  const next = structuredClone(state);
  const amount = next.pool[sender] ?? 0;
  delete next.pool[sender];
  next.active = next.active.filter(v => v !== sender);
  delete next.pending[sender];
  delete next.claims[sender];
  if (amount > 0) {
    if (next.stakingVault < amount) throw new Error("insufficient staking vault: fail closed");
    next.stakingVault -= amount;
    next.coopVault += amount;
  }
  return next;
}

const base = {
  pool: {alice: 40, bob: 60}, active: ["alice", "bob"], pending: {},
  claims: {}, stakingVault: 100, coopVault: 0
};

test("positive: selected invalid and bonded sender is a slash candidate", () => {
  assert.deepEqual(selectSlashCandidates({
    justifications: [{sender:"alice",validationFailed:true}, {sender:"bob",validationFailed:false}],
    bonds: {alice:40,bob:60}
  }), ["alice"]);
});

test("negative: unselected invalid block is not an offender under the observed selection expression", () => {
  assert.deepEqual(selectSlashCandidates({
    justifications: [{sender:"bob",validationFailed:false}],
    bonds: {alice:40,bob:60}
  }), []);
});

test("negative: unbonded sender is excluded; duplicate selected metadata cannot double-charge", () => {
  assert.deepEqual(selectSlashCandidates({
    justifications: [{sender:"alice",validationFailed:true},{sender:"alice",validationFailed:true},{sender:"eve",validationFailed:true}],
    bonds: {alice:40,bob:60}
  }), ["alice"]);
});

test("state-model: slash clears pending request and conserves the two vaults", () => {
  const s=structuredClone(base); s.pending.alice=16;
  const n=applySlash(s,"alice");
  assert.equal(n.pool.alice,undefined);assert.equal(n.pending.alice,undefined);
  assert.deepEqual(n.active,["bob"]);
  assert.equal(n.stakingVault,60);assert.equal(n.coopVault,40);
  assert.equal(n.stakingVault+n.coopVault,s.stakingVault+s.coopVault);
  assert.equal(s.pool.alice,40,"input remains unchanged");
});

test("state-model: already removed sender is not double-confiscated", () => {
  const once=applySlash(base,"alice");
  assert.deepEqual(applySlash(once,"alice"),once);
});

test("state-model: insufficient staking vault cannot mint into Coop", () => {
  const s=structuredClone(base); s.stakingVault=39;
  assert.throws(()=>applySlash(s,"alice"),/insufficient staking vault/);
});

// Independent negative control: the model makes no slash inference from delay alone.
test("negative: delayed healthy justification is not an invalid-block signal", () => {
  assert.deepEqual(selectSlashCandidates({
    justifications:[{sender:"bob",validationFailed:false,delayed:true}],
    bonds:{alice:40,bob:60}
  }),[]);
});
