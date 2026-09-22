export type Report = {requestId:string;kind:'bug'|'proposal';title:string;description:string;version:string;area:string;links:string[];consentPublic:true;turnstileToken:string};
export function validateReport(value:unknown): Report {
  if(!value || typeof value!=='object' || Array.isArray(value))throw Error('Invalid report');
  const v=value as Record<string,unknown>;
  const string=(key:string,max:number)=>{const s=v[key];if(typeof s!=='string'||!s.trim()||s.length>max)throw Error(`Invalid ${key}`);return s.trim();};
  const requestId=string('requestId',36);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw Error('Invalid requestId');
  if(v.kind!=='bug'&&v.kind!=='proposal')throw Error('Invalid kind');
  if(v.consentPublic!==true)throw Error('Public consent required');
  const area=string('area',20);if(!['firmware','companion','usb','docs','other'].includes(area))throw Error('Invalid area');
  if(!Array.isArray(v.links)||v.links.length>3)throw Error('Invalid links');
  const links=v.links.map(s=>{if(typeof s!=='string'||s.length>2048)throw Error('Invalid link');const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password)throw Error('HTTPS links only');return u.href;});
  return {requestId,kind:v.kind,title:string('title',120),description:string('description',8000),version:string('version',80),area,links,consentPublic:true,turnstileToken:string('turnstileToken',2048)};
}
