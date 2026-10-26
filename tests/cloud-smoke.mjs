// Live-service smoke state is disposable QA data, stored only in an ignored folder.
import { writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import * as C from "../web/src/crypto.js";
const base=process.env.SV_TEST_URL||"https://secretvault-api-thienphuc.onrender.com";
const stateFile="audit/runtime-cloud/production-smoke.json";
let state;
try { state=JSON.parse(await readFile(stateFile,"utf8")); } catch { state={email:`smoke-${Date.now()}@example.test`,password:"Disposable-QA-cloud-2026!"}; }
if(!state.body){
  const account=await C.makeAccount(state.email,state.password);
  state.body={name:"Cloud QA",email:state.email,authProof:await C.authProof(state.email,state.password),public:account.public,bundle:account.bundle,proof:await C.sign(account.identity,{purpose:"register-v2",email:state.email,public:account.public})};
  await writeFile(stateFile,JSON.stringify(state));
}
const started=Date.now();
const path=process.env.SV_SMOKE_LOGIN?"/api/login":"/api/register";
const response=await fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state.body)});
const raw=await response.text();
console.log(JSON.stringify({path,status:response.status,bytes:raw.length,seconds:(Date.now()-started)/1000,headers:Object.fromEntries(response.headers)}));
if(raw) {
  const value=JSON.parse(raw);
  console.log(JSON.stringify({keys:Object.keys(value),error:value.error||null}));
  if(response.ok){state.response=value;await writeFile(stateFile,JSON.stringify(state));assert.ok(value.token&&value.bundle&&value.user);}
}
assert.ok(raw.length>0,"API response was empty");
assert.equal(response.status,200);
