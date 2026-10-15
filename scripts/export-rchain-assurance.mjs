// Export only the browser-safe v1 verifier, generated from canonical Compiler sources.
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const target = resolve(process.argv[2] ?? "dist/rchain-assurance-v1");
execFileSync(process.execPath,["node_modules/typescript/bin/tsc","-p","tsconfig.assurance.json"],{stdio:"inherit"});
mkdirSync(target,{recursive:true});
const files = [];
for(const name of ["rchain-rev-transfer-v1","rchain-assurance-validation","rchain-assurance-schema"]) for(const extension of ["js","d.ts"]) { const file = `${name}.${extension}`; copyFileSync(`dist/assurance-engine/lib/lib/assurance/${file}`,`${target}/${file}`); files.push(file); }
writeFileSync(`${target}/package.json`,JSON.stringify({name:"@aixaria/rchain-assurance-v1",version:"1.0.0",type:"module",private:true,exports:{".":{types:"./rchain-rev-transfer-v1.d.ts",import:"./rchain-rev-transfer-v1.js"},"./integrity":{types:"./rchain-assurance-validation.d.ts",import:"./rchain-assurance-validation.js"}}},null,2)+"\n");
files.push("package.json");
writeFileSync(`${target}/SOURCE.json`,JSON.stringify({repository:"aixaria0/RCHAIN-COMPLIER",revision:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),contract:"rchain-assurance/v1",files:Object.fromEntries(files.map(file=>[file,createHash("sha256").update(readFileSync(`${target}/${file}`)).digest("hex")]))},null,2)+"\n");
console.log(target);
