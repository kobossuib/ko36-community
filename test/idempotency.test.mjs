import test from 'node:test';
import assert from 'node:assert/strict';
import {submit,Conflict} from '../src/submissions.ts';
const report=()=>({requestId:crypto.randomUUID(),kind:'bug',title:'USB',description:'Steps',version:'unknown',area:'usb',links:[],consentPublic:true,turnstileToken:'test'});
function store(){const rows=new Map();return {reserve:async(id,hash,receipt,now)=>{if(rows.has(id))return false;rows.set(id,{request_id:id,content_hash:hash,receipt,status:'pending',created_at:now});return true;},get:async id=>rows.get(id)||null,confirm:async(id,t)=>Object.assign(rows.get(id),{status:'confirmed',issue_number:t.number,issue_url:t.url}),fail:async id=>Object.assign(rows.get(id),{status:'failed'})};}
test('concurrent double submit creates a single confirmed ticket',async()=>{
  const db=store(),r=report();let calls=0;
  const create=async()=>{calls++;return{number:42,url:'https://github.com/kobossuib/ko36-community/issues/42'};};
  await Promise.all([submit(r,db,create),submit(r,db,create)]);
  assert.equal(calls,1);assert.equal((await db.get(r.requestId)).status,'confirmed');
});
test('different body with same id conflicts',async()=>{
  const db=store(),r=report(),create=async()=>({number:1,url:'https://github.com/kobossuib/ko36-community/issues/1'});
  await submit(r,db,create);await assert.rejects(submit({...r,title:'Changed'},db,create),Conflict);
});
test('lost response never repeats issue creation',async()=>{
  const db=store(),r=report();let calls=0;
  const create=async()=>{calls++;throw Error('connection lost after creation');};
  assert.equal((await submit(r,db,create)).status,'pending');
  assert.equal((await submit({...r,turnstileToken:'refreshed'},db,create)).status,'pending');
  assert.equal(calls,1);
});
