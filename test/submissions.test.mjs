import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReport } from '../src/validation.ts';

export const valid=()=>({requestId:crypto.randomUUID(),kind:'bug',title:'USB reconnect',description:'Disconnect cable; reconnect. Expected connected; observed disconnected.',version:'unknown',area:'usb',links:[],consentPublic:true,turnstileToken:'test'});
test('valid report preserves unicode and treats HTML as data',()=>{
  const report={...valid(),title:'<script>ñ</script>'};assert.equal(validateReport(report).title,report.title);
});
test('consent, title, body, kind, links and UUID are validated',()=>{
  for(const change of [{consentPublic:false},{title:''},{title:'a'.repeat(121)},{description:'a'.repeat(8001)},{kind:'command'},{links:['javascript:alert(1)']},{links:['https://a','https://b','https://c','https://d']},{requestId:'../../'}])assert.throws(()=>validateReport({...valid(),...change}));
});
