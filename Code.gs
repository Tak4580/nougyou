const CONFIG=Object.freeze({KINTONE_DOMAIN:'7ajlzf24nxnk.cybozu.com',APP_ID_PROPERTY:'KINTONE_APP_ID',DEFAULT_APP_ID:6,TOKEN_PROPERTY:'KINTONE_API_TOKEN',MEMBER_TOKEN_PROPERTY:'KINTONE_MEMBER_API_TOKEN',MEMBER_APP_ID_PROPERTY:'KINTONE_MEMBER_APP_ID',MEMBER_FIELD_MAP_PROPERTY:'KINTONE_MEMBER_FIELD_MAP'});
const FIELDS=['work_month','management_store','staff','member_no','name','furigana','zip_code','address','phone','subscriber_type','contract_type','copies','contract_status','application_date','start_date','certificate','notes','delivery_shop_code','delivery_shop','delivery_note','payment_method','email','receipt','bank_code','bank_branch_code','account_type','account_number','account_name','cancel_accept_date','end_date','cancel_reason'];

function doGet(){return json_({ok:true,version:'SUBSCRIBER-CONTRACT-V1',message:'購読者・契約管理アプリ対応版です。'});}
function doPost(e){
  try{
    const b=parse_(e); if(b.website)return json_({ok:true});
    if(b.action==='health'){token_();return json_({ok:true,message:'GAS・kintone接続は正常です。'});}
    if(b.action==='list')return json_({ok:true,records:list_()});
    if(b.action==='lookupMember')return json_({ok:true,record:lookupMember_(b.member_no)});
    if(b.action==='create'){const r=create_(norm_(b));return json_({ok:true,recordId:r.id});}
    if(b.action==='update'){const r=update_(rid_(b.record_id),norm_(b));return json_({ok:true,revision:r.revision});}
    if(b.action==='delete'){remove_(rid_(b.record_id));return json_({ok:true});}
    return json_({ok:false,message:'操作が正しくありません。'});
  }catch(err){return json_({ok:false,message:err.message||String(err)});}
}
function list_(){
  return enrichMembers_(rawList_());
}
function rawList_(){
  const ps=[`app=${appId_()}`,`query=${encodeURIComponent('order by $id desc limit 500')}`];
  ['$id'].concat(FIELDS).forEach((f,i)=>ps.push(`fields[${i}]=${encodeURIComponent(f)}`));
  const d=req_(`https://${CONFIG.KINTONE_DOMAIN}/k/v1/records.json?${ps.join('&')}`,{method:'get'});
  return d.records.map(r=>{const o={id:r.$id.value};FIELDS.forEach(f=>o[f]=r[f]?r[f].value:'');return o;});
}
function lookupMember_(memberNo){
  const no=String(memberNo||'').trim();
  if(!no)throw new Error('組合員番号を入力してください。');
  const appId=memberAppId_();
  const map=memberFieldMap_();
  const query=`${map.member_no} = "${kq_(no)}" limit 1`;
  const fields=['$id'].concat(Array.from(new Set(Object.values(map))));
  const ps=[`app=${appId}`,`query=${encodeURIComponent(query)}`];
  fields.forEach((f,i)=>ps.push(`fields[${i}]=${encodeURIComponent(f)}`));
  const d=req_(`https://${CONFIG.KINTONE_DOMAIN}/k/v1/records.json?${ps.join('&')}`,{method:'get'},memberToken_());
  const r=(d.records||[])[0];
  if(!r)return null;
  const o={id:r.$id.value};
  Object.keys(map).forEach(k=>{const f=map[k];o[k]=r[f]?r[f].value:'';});
  return o;
}
function enrichMembers_(records){
  const nos=Array.from(new Set(records.map(r=>String(r.member_no||'').trim()).filter(Boolean)));
  if(!nos.length)return records;
  const map=memberFieldMap_();
  const fields=['$id'].concat(Array.from(new Set(Object.values(map))));
  const chunks=[];
  for(let i=0;i<nos.length;i+=100)chunks.push(nos.slice(i,i+100));
  const byNo={};
  chunks.forEach(ns=>{
    const query=`${map.member_no} in (${ns.map(n=>`"${kq_(n)}"`).join(',')}) limit 500`;
    const ps=[`app=${memberAppId_()}`,`query=${encodeURIComponent(query)}`];
    fields.forEach((f,i)=>ps.push(`fields[${i}]=${encodeURIComponent(f)}`));
    const d=req_(`https://${CONFIG.KINTONE_DOMAIN}/k/v1/records.json?${ps.join('&')}`,{method:'get'},memberToken_());
    (d.records||[]).forEach(r=>{
      const o={id:r.$id.value};
      Object.keys(map).forEach(k=>{const f=map[k];o[k]=r[f]?r[f].value:'';});
      if(o.member_no)byNo[String(o.member_no).trim()]=o;
    });
  });
  return records.map(r=>{
    const m=byNo[String(r.member_no||'').trim()];
    return m?Object.assign({},r,{name:m.name,furigana:m.furigana,zip_code:m.zip_code,address:m.address,phone:m.phone,subscriber_type:m.subscriber_type||r.subscriber_type,management_store:m.management_store||r.management_store}):r;
  });
}
function create_(d){return req_(`https://${CONFIG.KINTONE_DOMAIN}/k/v1/record.json`,{method:'post',contentType:'application/json',payload:JSON.stringify({app:appId_(),record:krec_(d)})});}
function update_(id,d){return req_(`https://${CONFIG.KINTONE_DOMAIN}/k/v1/record.json`,{method:'put',contentType:'application/json',payload:JSON.stringify({app:appId_(),id,record:krec_(d)})});}
function remove_(id){return req_(`https://${CONFIG.KINTONE_DOMAIN}/k/v1/records.json`,{method:'delete',contentType:'application/json',payload:JSON.stringify({app:appId_(),ids:[id]})});}
function krec_(d){const r={};FIELDS.forEach(f=>r[f]={value:d[f]??''});return r;}
function norm_(b){const o={};FIELDS.forEach(f=>o[f]=b[f]??'');mergeMemberInto_(o);if(!String(o.name||'').trim())throw new Error('氏名を入力してください。');if(!/^\d{4}-\d{2}-\d{2}$/.test(String(o.start_date||'')))throw new Error('購読開始日を正しく入力してください。');o.copies=Number(o.copies||1);return o;}
function mergeMemberInto_(o){
  if(!String(o.member_no||'').trim())return o;
  const m=lookupMember_(o.member_no);
  if(!m)return o;
  ['member_no','name','furigana','zip_code','address','phone'].forEach(k=>{if(m[k]!==undefined&&m[k]!==null)o[k]=m[k];});
  ['subscriber_type','management_store'].forEach(k=>{if(m[k])o[k]=m[k];});
  return o;
}
function req_(url,opt,apiToken){const res=UrlFetchApp.fetch(url,Object.assign({},opt,{headers:Object.assign({},opt.headers||{}, {'X-Cybozu-API-Token':apiToken||token_()}),muteHttpExceptions:true}));const st=res.getResponseCode(),tx=res.getContentText();let d={};try{d=tx?JSON.parse(tx):{}}catch(_){throw new Error(`kintoneからJSON以外の応答（HTTP ${st}）`);}if(st<200||st>=300)throw new Error(`kintone APIエラー: ${d.message||d.code||tx}${d.errors?' '+JSON.stringify(d.errors):''}`);return d;}
function parse_(e){if(!e||!e.postData||!e.postData.contents)throw new Error('送信データがありません。');return JSON.parse(e.postData.contents);}
function rid_(v){const id=String(v||'');if(!/^\d+$/.test(id))throw new Error('レコードIDが不正です。');return id;}
function token_(){const t=PropertiesService.getScriptProperties().getProperty(CONFIG.TOKEN_PROPERTY);if(!t)throw new Error('KINTONE_API_TOKENが未設定です。');return t;}
function appId_(){const id=String(PropertiesService.getScriptProperties().getProperty(CONFIG.APP_ID_PROPERTY)||CONFIG.DEFAULT_APP_ID);if(!/^\d+$/.test(id))throw new Error('KINTONE_APP_IDが不正です。購読管理アプリのアプリIDを数字で設定してください。');return id;}
function memberToken_(){const t=PropertiesService.getScriptProperties().getProperty(CONFIG.MEMBER_TOKEN_PROPERTY);if(!t)throw new Error('KINTONE_MEMBER_API_TOKENが未設定です。組合員名簿アプリの閲覧権限つきAPIトークンを設定してください。');return t;}
function memberAppId_(){const id=String(PropertiesService.getScriptProperties().getProperty(CONFIG.MEMBER_APP_ID_PROPERTY)||'');if(!/^\d+$/.test(id))throw new Error('KINTONE_MEMBER_APP_IDが未設定です。組合員名簿アプリのアプリIDを設定してください。');return id;}
function memberFieldMap_(){
  const defaults={member_no:'member_no',name:'member_name',furigana:'member_kana',zip_code:'member_zip',address:'member_address',phone:'member_phone',subscriber_type:'subscriber_type',management_store:'management_store'};
  const raw=PropertiesService.getScriptProperties().getProperty(CONFIG.MEMBER_FIELD_MAP_PROPERTY);
  if(!raw)return defaults;
  try{return Object.assign({},defaults,JSON.parse(raw));}catch(_){throw new Error('KINTONE_MEMBER_FIELD_MAPのJSON形式が正しくありません。');}
}
function kq_(v){return String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"');}
function json_(b){return ContentService.createTextOutput(JSON.stringify(b)).setMimeType(ContentService.MimeType.JSON);}
