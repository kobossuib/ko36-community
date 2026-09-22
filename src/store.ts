import type {Store,Row,Ticket} from './submissions.ts';

export class SubmissionStore implements Store {
  db:D1Database;
  constructor(db:D1Database){this.db=db;}
  async reserve(id:string,hash:string,receipt:string,now:number) {
    const result=await this.db.prepare("INSERT OR IGNORE INTO submissions(request_id,content_hash,receipt,status,created_at) VALUES(?,?,?,'pending',?)").bind(id,hash,receipt,now).run();
    return result.meta.changes===1;
  }
  get(id:string){return this.db.prepare('SELECT * FROM submissions WHERE request_id=?').bind(id).first<Row>();}
  byReceipt(receipt:string){return this.db.prepare('SELECT * FROM submissions WHERE receipt=?').bind(receipt).first<Row>();}
  async confirm(id:string,ticket:Ticket){await this.db.prepare("UPDATE submissions SET status='confirmed',issue_number=?,issue_url=? WHERE request_id=?").bind(ticket.number,ticket.url,id).run();}
  async fail(id:string){await this.db.prepare("UPDATE submissions SET status='failed' WHERE request_id=?").bind(id).run();}
  async canReconcile(id:string,now:number){const r=await this.db.prepare("UPDATE submissions SET checked_at=? WHERE request_id=? AND checked_at<? AND status='pending'").bind(now,id,now-60000).run();return r.meta.changes===1;}
  async limit(bucket:string,max:number,expiry:number){
    const row=await this.db.prepare('INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind(bucket,expiry).first<{hits:number}>();
    return row!==null&&row.hits<=max;
  }
  async cleanup(now:number){
    await this.db.batch([
      this.db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now),
      this.db.prepare("UPDATE submissions SET status='failed' WHERE status='pending' AND created_at<?").bind(now-7*86400000),
      this.db.prepare('DELETE FROM submissions WHERE created_at<?').bind(now-30*86400000)
    ]);
  }
}
