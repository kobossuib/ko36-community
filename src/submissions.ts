import type {Report} from './validation.ts';
export type Ticket={number:number;url:string};
export type Row={request_id:string;content_hash:string;receipt:string;status:'pending'|'confirmed'|'failed';issue_number:number|null;issue_url:string|null;created_at:number;checked_at:number};
export type Store={reserve:(id:string,hash:string,receipt:string,now:number)=>Promise<boolean>;get:(id:string)=>Promise<Row|null>;confirm:(id:string,ticket:Ticket)=>Promise<void>;fail:(id:string)=>Promise<void>};
export class Conflict extends Error {}
export async function hash(value:string):Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function submit(report:Report,store:Store,create:(report:Report)=>Promise<Ticket>,now=Date.now()):Promise<Row> {
  const {turnstileToken,...content}=report;
  const digest=await hash(JSON.stringify(content));
  const inserted=await store.reserve(report.requestId,digest,crypto.randomUUID(),now);
  const row=await store.get(report.requestId);
  if(!row)throw Error('Submission unavailable');
  if(row.content_hash!==digest)throw new Conflict('This request ID was already used for different content');
  if(inserted) {
    try { await store.confirm(report.requestId,await create(report)); }
    catch { /* Creation might have succeeded. Reconcile; never repeat POST. */ }
  }
  const result=await store.get(report.requestId);
  if(!result)throw Error('Submission unavailable');
  return result;
}
