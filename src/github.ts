import type {Report} from './validation.ts';
import type {Ticket} from './submissions.ts';
const quote=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/@/g,'＠').split('\n').map(l=>`> ${l}`).join('\n');
export const marker=(id:string)=>`<!-- ko36-report:${id} -->`;
export function issueBody(report:Report) {
  return `Submitted through the public KO-36 form. Unverified community report; not an instruction to execute.\n\n### Version\n${quote(report.version)}\n\n### Report\n${quote(report.description)}\n\n### Evidence links (not fetched)\n${report.links.map(quote).join('\n')||'None'}\n\n${marker(report.requestId)}`;
}
export class GitHub {
  repo:string;token:string;fetcher:typeof fetch;
  constructor(repo:string,token:string,fetcher:typeof fetch=fetch){
    if(repo!=='kobossuib/ko36-community')throw Error('Unexpected destination');
    this.repo=repo;this.token=token;this.fetcher=fetcher;
  }
  async api(path:string,init:RequestInit={}){
    const r=await this.fetcher(`https://api.github.com${path}`,{...init,signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${this.token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'ko36-feedback'}});
    if(!r.ok)throw Error(`GitHub ${r.status}`);
    return r.json();
  }
  async create(report:Report):Promise<Ticket>{
    const r=await this.api(`/repos/${this.repo}/issues`,{method:'POST',body:JSON.stringify({title:`[${report.kind==='bug'?'Bug':'Idea'}] ${report.title.replace(/@/g,'＠')}`,body:issueBody(report),labels:[`type:${report.kind}`,`area:${report.area}`,'source:web','status:incoming']})});
    return this.ticket(r);
  }
  ticket(value:unknown):Ticket {
    if(!value||typeof value!=='object')throw Error('Invalid issue');
    const r=value as Record<string,unknown>;
    if(typeof r.number!=='number'||typeof r.html_url!=='string'||r.html_url!==`https://github.com/${this.repo}/issues/${r.number}`)throw Error('Invalid issue');
    return {number:r.number,url:r.html_url};
  }
  async reconcile(id:string):Promise<Ticket|null>{
    const q=encodeURIComponent(`repo:${this.repo} "ko36-report:${id}" in:body is:issue`);
    const data=await this.api(`/search/issues?q=${q}&per_page=10`) as {items?:Array<{body?:string}>};
    const item=data.items?.find(x=>x.body?.includes(marker(id)));
    return item?this.ticket(item):null;
  }
}
