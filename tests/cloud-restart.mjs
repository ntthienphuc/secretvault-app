import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import * as C from "../web/src/crypto.js";
const fixture=JSON.parse(await readFile("audit/runtime-cloud/production-resume.json","utf8"));
const checks=[];
async function req(path,{method="GET",body,token,binary=false,status=200}={}){
  const headers={};if(token)headers.Authorization="Bearer "+token;if(body!==undefined)headers["Content-Type"]="application/json";
  const r=await fetch(fixture.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal(r.status,status,path);return binary?new Uint8Array(await r.arrayBuffer()):r.json();
}
const owner=fixture.users[0];
const login=await req("/api/login",{method:"POST",body:{email:owner.email,authProof:await C.authProof(owner.email,fixture.password)}});
checks.push("Account credentials and encrypted identity survive a live service restart");
const identity=await C.unlockAccount(owner.email,fixture.password,login.bundle,login.user.public);
const state=await req("/api/bootstrap",{token:login.token});
const file=state.files.find(f=>f.id===fixture.fileId);assert.ok(file);
checks.push("Stored file metadata and owner access are restored from the private bucket");
await C.verify(login.user.public,file.manifest,file.signature);
const key=await C.unwrapOwner(identity,file);const output=[];
for(const chunk of file.manifest.chunks){
  const data=await req(`/api/files/${file.id}/chunks/${chunk.index}`,{token:login.token,binary:true});
  assert.equal(await C.hash(data),chunk.hash);
  output.push(await C.decrypt(key,{iv:chunk.iv,data:C.b64(data)},C.fileAad(file.id,login.user.id,chunk.index,file.manifest.chunks.length,file.manifest.size)));
}
const joined=new Uint8Array(output.reduce((n,x)=>n+x.length,0));let offset=0;for(const x of output){joined.set(x,offset);offset+=x.length;}
assert.equal(await C.hash(joined),fixture.plaintextHash);key.fill(0);joined.fill(0);
checks.push("Persistent ciphertext downloads and decrypts to the exact pre-restart plaintext hash");
await req("/api/admin/overview",{token:login.token,status:403});
checks.push("Restart does not grant administrator privileges to a regular account");
const receiver=fixture.users[1];const other=await req("/api/login",{method:"POST",body:{email:receiver.email,authProof:await C.authProof(receiver.email,fixture.password)}});
await req(`/api/files/${file.id}/chunks/0`,{token:other.token,status:403});
checks.push("Revoked sharing permissions remain revoked after restart");
await writeFile("audit/cloud-production-restart-results.json",JSON.stringify({timestamp:new Date().toISOString(),target:fixture.base,passed:checks.length,checks},null,2));
console.log(JSON.stringify({passed:checks.length,checks}));
