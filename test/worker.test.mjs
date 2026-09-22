import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{readBounded} from '../src/worker.ts';
import {SubmissionStore} from '../src/store.ts';
import {issueBody} from '../src/github.ts';

function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/0001_submissions.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const stmt=sqlite.prepare(sql);let values=[];const q={bind(...v){values=v;return q;},async run(){const r=stmt.run(...values);return{meta:{changes:Number(r.changes)}};},async first(){return stmt.get(...values)||null;}};return q;},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
 return {db,close:()=>sqlite.close()};
}
const body=()=>({requestId:crypto.randomUUID(),kind:'bug',title:'USB reconnect',description:'Cable unplugged then replugged',version:'0.3.21',area:'usb',links:[],consentPublic:true,turnstileToken:'valid'});
const request=data=>new Request('https://feedback.test/api/reports',{method:'POST',headers:{Origin:'https://feedback.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(data)});
test('D1 unique reservation and global rate counter are enforced by real SQLite',async()=>{
 const {db,close}=database();try{const s=new SubmissionStore(db);assert.deepEqual(await Promise.all([s.reserve('id','hash','receipt',1),s.reserve('id','hash','receipt2',1)]),[true,false]);assert.equal(await s.limit('global',1,100),true);assert.equal(await s.limit('global',1,100),false);await s.cleanup(200);assert.equal(await s.limit('global',1,300),true);}finally{close();}
});
test('HTTP flow verifies challenge, creates ticket, returns receipt and prevents duplicate creation',async()=>{
 const {db,close}=database(),original=globalThis.fetch;let creates=0;
 globalThis.fetch=async(url)=>{if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'feedback.test',action:'report'});creates++;return Response.json({number:7,html_url:'https://github.com/kobossuib/ko36-community/issues/7'});};
 try{
 const env={DB:db,GITHUB_REPO:'kobossuib/ko36-community',GITHUB_TOKEN:'test',TURNSTILE_SECRET:'test',IP_HASH_SECRET:'test',TURNSTILE_SITE_KEY:'test',FORM_ENABLED:'true',IP_LIMIT:'5',GLOBAL_LIMIT:'100'};
 const r=body();const first=await worker.fetch(request(r),env);assert.equal(first.status,201);const data=await first.json();assert.equal(data.number,7);
 assert.equal((await worker.fetch(request(r),env)).status,201);assert.equal(creates,1);
 assert.equal((await worker.fetch(request({...r,title:'different'}),env)).status,409);
 const receipt=await worker.fetch(new Request('https://feedback.test/api/receipts/'+data.receipt),env);assert.equal((await receipt.json()).status,'confirmed');
 assert.equal((await worker.fetch(new Request('https://feedback.test/api/receipts/'+crypto.randomUUID()),env)).status,404);
 }finally{globalThis.fetch=original;close();}
});
test('invalid challenge, disabled form, oversized body and cross-origin request cannot create issues',async()=>{
 const {db,close}=database(),original=globalThis.fetch;globalThis.fetch=async()=>Response.json({success:false});
 const env={DB:db,GITHUB_REPO:'kobossuib/ko36-community',GITHUB_TOKEN:'test',TURNSTILE_SECRET:'test',IP_HASH_SECRET:'test',TURNSTILE_SITE_KEY:'test',FORM_ENABLED:'true',IP_LIMIT:'5',GLOBAL_LIMIT:'100'};
 try{
 assert.equal((await worker.fetch(request(body()),{...env,FORM_ENABLED:'false'})).status,503);
 assert.equal((await worker.fetch(request(body()),env)).status,400);
 assert.equal((await worker.fetch(request({...body(),description:'a'.repeat(20000)}),env)).status,413);
 const cross=request(body());cross.headers.set('Origin','https://evil.test');assert.equal((await worker.fetch(cross,env)).status,403);
 }finally{globalThis.fetch=original;close();}
});
test('pending response can reconcile an issue created before a connection loss',async()=>{
 const {db,close}=database(),original=globalThis.fetch;const r=body();
 globalThis.fetch=async url=>String(url).includes('siteverify')?Response.json({success:true,hostname:'feedback.test',action:'report'}):Promise.reject(Error('lost response'));
 const env={DB:db,GITHUB_REPO:'kobossuib/ko36-community',GITHUB_TOKEN:'test',TURNSTILE_SECRET:'test',IP_HASH_SECRET:'test',TURNSTILE_SITE_KEY:'test',FORM_ENABLED:'true',IP_LIMIT:'5',GLOBAL_LIMIT:'100'};
 try{
 const response=await worker.fetch(request(r),env);assert.equal(response.status,202);const data=await response.json();
 await db.prepare('UPDATE submissions SET created_at=? WHERE request_id=?').bind(Date.now()-20000,r.requestId).run();
 globalThis.fetch=async()=>Response.json({items:[{number:8,html_url:'https://github.com/kobossuib/ko36-community/issues/8',body:issueBody(r)}]});
 const found=await worker.fetch(new Request('https://feedback.test/api/receipts/'+data.receipt),env);assert.equal((await found.json()).number,8);
 }finally{globalThis.fetch=original;close();}
});
test('streaming body limit does not trust Content-Length',async()=>{
 await assert.rejects(readBounded(new Request('https://feedback.test',{method:'POST',body:'a'.repeat(20000)})),RangeError);
});
