import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { sha256Artifact } from "./ecosystem-chain.ts";
import { PORTABLE_ASSURANCE_PACKAGE_SCHEMA, type PortableAssurancePackage } from "./portable-assurance-package.ts";
import { canonicalPackageRoot, signPackageRoot, verifySignedPackageRoot } from "./signed-package-root.ts";

function pkg(): PortableAssurancePackage {
  const bytes=["witness","evidence","workbench","attestation"], digests=bytes.map(sha256Artifact);
  return { schema:PORTABLE_ASSURANCE_PACKAGE_SCHEMA, runId:"root-fixture", subject:"generic-system",
    artifacts:[
      {role:"WITNESS",bytes:bytes[0],sha256:digests[0],bindsTo:[]},
      {role:"EVIDENCE",bytes:bytes[1],sha256:digests[1],bindsTo:[digests[0]]},
      {role:"WORKBENCH",bytes:bytes[2],sha256:digests[2],bindsTo:[digests[0],digests[1]]},
      {role:"ATTESTATION",bytes:bytes[3],sha256:digests[3],bindsTo:[digests[0],digests[1],digests[2]]},
    ]};
}
function keys(){return generateKeyPairSync("ed25519").privateKey.export({type:"pkcs8",format:"pem"}).toString();}

test("canonical package root is deterministic and Ed25519-verifiable",()=>{
 const p=pkg(), key=keys(), signed=signPackageRoot(p,key);
 assert.equal(canonicalPackageRoot(p),canonicalPackageRoot(p));
 assert.equal(verifySignedPackageRoot(p,signed),true);
});
test("raw-byte mutation invalidates signed package",()=>{
 const p=pkg(), signed=signPackageRoot(p,keys()); p.artifacts[1].bytes+="!";
 assert.equal(verifySignedPackageRoot(p,signed),false);
});
test("artifact reordering is rejected before root verification",()=>{
 const p=pkg(), signed=signPackageRoot(p,keys()); [p.artifacts[0],p.artifacts[1]]=[p.artifacts[1],p.artifacts[0]];
 assert.equal(verifySignedPackageRoot(p,signed),false);
});
test("valid artifact substitution from another package breaks root binding",()=>{
 const p=pkg(), signed=signPackageRoot(p,keys());
 const replacement="different-evidence", d=sha256Artifact(replacement);
 p.artifacts[1]={role:"EVIDENCE",bytes:replacement,sha256:d,bindsTo:[p.artifacts[0].sha256]};
 p.artifacts[2].bindsTo=[p.artifacts[0].sha256,d]; p.artifacts[3].bindsTo=[p.artifacts[0].sha256,d,p.artifacts[2].sha256];
 assert.equal(verifySignedPackageRoot(p,signed),false);
});
