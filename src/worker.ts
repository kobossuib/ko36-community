import {validateReport} from './validation.ts';
import {submit,Conflict,hash} from './submissions.ts';
import type {Row} from './submissions.ts';
import {SubmissionStore} from './store.ts';
import {GitHub} from './github.ts';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
function receipt(row:Row){return {status:row.status,receipt:row.receipt,...(row.status==='confirmed'?{issueUrl:row.issue_url,number:row.issue_number}:{})};}
export async function readBounded(request:Request,max=16384){
  const reader=request.body?.getReader();if(!reader)throw Error('Empty body');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new RangeError('Report too large');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    const enabled=env.FORM_ENABLED==='true'&&!!env.GITHUB_TOKEN&&!!env.TURNSTILE_SECRET&&!!env.IP_HASH_SECRET&&!!env.TURNSTILE_SITE_KEY;
    if(url.pathname==='/api/config'&&request.method==='GET')return json({enabled,siteKey:env.TURNSTILE_SITE_KEY,repo:env.GITHUB_REPO});
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(!enabled)return json({error:'Form temporarily unavailable. Please use GitHub Issues.'},503);
    const store=new SubmissionStore(env.DB), github=new GitHub(env.GITHUB_REPO,env.GITHUB_TOKEN!);
    try {
      const now=Date.now();
      const ip=request.headers.get('CF-Connecting-IP')||'unknown';
      const identity=await hash(`${env.IP_HASH_SECRET}:${Math.floor(now/86400000)}:${ip}`);
      // Shared D1 counters, not per-isolate memory. Also protects receipt probing.
      if(!await store.limit(`request:${identity}:${Math.floor(now/60000)}`,30,now+120000))return json({error:'Too many requests; retry later'},429);
      if(url.pathname.startsWith('/api/receipts/')&&request.method==='GET'){
        const id=url.pathname.slice('/api/receipts/'.length);
        if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Receipt not found'},404);
        let row=await store.byReceipt(id);if(!row)return json({error:'Receipt not found'},404);
        if(row.status==='pending'&&row.created_at<now-7*86400000){await store.fail(row.request_id);row=(await store.get(row.request_id))!;}
        if(row.status==='pending'&&row.created_at<now-15000&&await store.canReconcile(row.request_id,now)){
          try{const ticket=await github.reconcile(row.request_id);if(ticket)await store.confirm(row.request_id,ticket);}catch{/* Pending stays visible. */}
          row=(await store.get(row.request_id))!;
        }
        return json(receipt(row));
      }
      if(url.pathname!=='/api/reports')return json({error:'Not found'},404);
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      if(request.headers.get('Origin')!==url.origin)return json({error:'Invalid origin'},403);
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
      let report;
      try{report=validateReport(await readBounded(request));}catch(error){return json({error:error instanceof Error?error.message:'Invalid report'},error instanceof RangeError?413:400);}
      const challenge=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',signal:AbortSignal.timeout(10000),body:new URLSearchParams({secret:env.TURNSTILE_SECRET!,response:report.turnstileToken,remoteip:ip})});
      const verification=await challenge.json() as {success?:boolean;hostname?:string;action?:string};
      if(!verification.success||verification.hostname!==url.hostname||verification.action!=='report')return json({error:'Verification failed; please retry'},400);
      if(!await store.get(report.requestId)) {
        if(!await store.limit(`submit:${identity}:${Math.floor(now/3600000)}`,Number(env.IP_LIMIT),now+3600000)||!await store.limit(`global:${Math.floor(now/3600000)}`,Number(env.GLOBAL_LIMIT),now+3600000))return json({error:'Submission limit reached; please retry later'},429);
      }
      await store.cleanup(now);
      const row=await submit(report,store,r=>github.create(r),now);
      return json(receipt(row),row.status==='confirmed'?201:row.status==='failed'?409:202);
    }catch(error){
      if(error instanceof Conflict)return json({error:error.message},409);
      console.error(JSON.stringify({event:'feedback_error',kind:error instanceof Error?error.name:'unknown'}));
      return json({error:'Service unavailable. Keep your report and retry with the same reference.'},503);
    }
  }
} satisfies ExportedHandler<Env>;
