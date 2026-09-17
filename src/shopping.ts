import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './db.ts';

export class ShoppingError extends Error {
  status: number;
  constructor(message:string,status=400) {super(message);this.status=status;}
}
function check(ok:any,message:string,status=400):asserts ok {if(!ok)throw new ShoppingError(message,status);}
// Each non-empty line is kept verbatim. Never infer quantities or combine ingredients.
export function shoppingLines(snapshot:any):string[] {
  return typeof snapshot.shopping_list==='string'?snapshot.shopping_list.split(/\r?\n/).map((s:string)=>s.trim()).filter(Boolean):[];
}
export function shoppingExport(db:DatabaseSync,userId:string) {
  return db.prepare('SELECT assignment_id,purchased,revision,updated_at FROM shopping_progress WHERE user_id=? ORDER BY assignment_id').all(userId).map((r:any)=>({...r,purchased:JSON.parse(r.purchased)}));
}
export function shoppingLists(db:DatabaseSync,userId:string) {
  return db.prepare(`SELECT a.*,p.purchased,p.revision,p.updated_at FROM assignments a
    JOIN requests r ON r.id=a.request_id
    LEFT JOIN shopping_progress p ON p.assignment_id=a.id AND p.user_id=a.user_id
    WHERE a.user_id=? AND r.user_id=? AND r.active=1 AND a.kind='meal'
    AND a.version=(SELECT MAX(b.version) FROM assignments b WHERE b.request_id=a.request_id AND b.kind=a.kind)
    ORDER BY a.created_at DESC,a.id`).all(userId,userId).map((a:any)=>({assignment_id:a.id,title:a.title,version:a.version,is_demo:!!JSON.parse(a.snapshot).is_demo,items:shoppingLines(JSON.parse(a.snapshot)),purchased:JSON.parse(a.purchased||'[]'),revision:a.revision||0,updated_at:a.updated_at||null}));
}
export function saveShopping(db:DatabaseSync,userId:string,assignmentId:string,input:any,reset=false) {
  return transaction(db,()=>{
    const a=db.prepare('SELECT a.*,r.active FROM assignments a JOIN requests r ON r.id=a.request_id WHERE a.id=? AND a.user_id=? AND r.user_id=?').get(assignmentId,userId,userId) as any;
    check(a,'Plan not found.',404);
    const latest=db.prepare('SELECT id FROM assignments WHERE request_id=? AND kind=? ORDER BY version DESC,rowid DESC LIMIT 1').get(a.request_id,a.kind) as any;
    check(a.active&&latest?.id===a.id,'This plan has changed or is no longer active. Open your current shopping list.',409);
    check(a.kind==='meal','Choose a meal plan.');
    const items=shoppingLines(JSON.parse(a.snapshot));
    check(items.length,'Alex has not added a shopping list to this plan yet.');
    check(Number.isSafeInteger(input.revision)&&input.revision>=0,'Refresh your shopping list and try again.');
    const saved=db.prepare('SELECT * FROM shopping_progress WHERE assignment_id=? AND user_id=?').get(assignmentId,userId) as any;
    check(input.revision===(saved?.revision||0),'Your list changed in another tab. Reload it before trying again.',409);
    let purchased:number[]=JSON.parse(saved?.purchased||'[]');
    if(reset)purchased=[];
    else {
      check(Number.isSafeInteger(input.item_index)&&input.item_index>=0&&input.item_index<items.length,'Choose an item from this published shopping list.');
      check(typeof input.purchased==='boolean','Choose picked up or still needed.');
      purchased=purchased.filter(i=>i!==input.item_index);
      if(input.purchased)purchased.push(input.item_index);
      purchased.sort((a,b)=>a-b);
    }
    db.prepare(`INSERT INTO shopping_progress(assignment_id,user_id,purchased,revision) VALUES(?,?,?,1)
      ON CONFLICT(assignment_id) DO UPDATE SET purchased=excluded.purchased,revision=shopping_progress.revision+1,updated_at=CURRENT_TIMESTAMP`).run(assignmentId,userId,JSON.stringify(purchased));
    return {purchased,revision:(saved?.revision||0)+1};
  });
}
