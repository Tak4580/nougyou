// ── 新規登録・編集（edit.html） ──
const form = document.getElementById('form');

let memberLookupSeq = 0;
let lastMemberLookup = { no: '', record: null };
let formDirty = false;

// 組合員名簿から読み込んだ項目（名簿照合に成功したときだけ読み取り専用）
const MEMBER_FIELDS = ['management_store','name','furigana','zip_code','address','phone','subscriber_type'];

function setMemberLock(locked) {
  MEMBER_FIELDS.forEach(n => {
    const el = form.elements[n];
    if (!el) return;
    if (el.tagName === 'SELECT') el.disabled = locked;
    else el.readOnly = locked;
    el.classList.toggle('member-locked', locked);
  });
}
// 名簿の読込が成功している番号のときだけロック（見つからない/未照合なら手入力可）
function syncMemberLock() {
  const no = String(form.elements.member_no.value || '').trim();
  setMemberLock(!!(no && lastMemberLookup.record && lastMemberLookup.no === no));
}

async function lookupMember() {
  const input = form.elements.member_no;
  const no = String(input.value || '').trim();
  const status = document.getElementById('memberLookupStatus');
  const btn = document.getElementById('memberLookupBtn');
  if (!no) { status.textContent = ''; return; }
  const seq = ++memberLookupSeq;
  status.textContent = '組合員名簿を確認中…';
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    const d = await callGas({ action: 'lookupMember', member_no: no });
    if (seq !== memberLookupSeq) return;
    if (!d.ok) throw new Error(d.message);
    if (!d.record) {
      lastMemberLookup = { no: '', record: null };
      syncMemberLock();
      status.textContent = '一致する組合員は見つかりませんでした。手入力で登録できます。';
      return;
    }
    lastMemberLookup = { no, record: d.record };
    applyMemberRecord(d.record);
    status.textContent = '組合員名簿から読み込みました。';
  } catch(e) {
    if (seq === memberLookupSeq) {
      lastMemberLookup = { no: '', record: null };
      syncMemberLock();
      status.textContent = '名簿を読み込めませんでした。手入力で登録できます。';
      show('error', '組合員名簿の読み込みに失敗しました。\n' + e.message);
    }
  } finally {
    if (seq === memberLookupSeq) {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }
}

function applyMemberRecord(r) {
  ['member_no','name','furigana','zip_code','address','phone','subscriber_type','management_store'].forEach(k => {
    if (form.elements[k] && r[k] !== undefined && r[k] !== null) form.elements[k].value = r[k];
  });
  formDirty = true;
  updateUI();
  syncMemberLock();
}

function mergeMemberRecordPayload(p, r) {
  ['member_no','name','furigana','zip_code','address','phone','subscriber_type','management_store'].forEach(k => {
    if (r[k] !== undefined && r[k] !== null) p[k] = r[k];
  });
}

// ── form ──────────────────────────────────────────────
function resetForm() {
  form.reset();
  lastMemberLookup = { no: '', record: null };
  form.record_id.value         = '';
  form.work_month.value        = month5();
  form.application_date.value  = today();
  form.start_date.value        = today();
  form.copies.value            = 1;
  form.contract_type.value     = '紙版';
  form.contract_status.value   = '購読中';
  form.payment_method.value    = 'JA口座振替';
  document.getElementById('formTitle').textContent = '新規登録';
  document.getElementById('formDescription').textContent = '必要事項を入力して登録してください。';
  document.querySelector('#saveBtn .button-label').textContent = '登録する';
  updateUI();
  syncMemberLock();
}

function fillForm(r) {
  Object.entries(r).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v ?? ''; });
  form.record_id.value = r.id;
  document.getElementById('formTitle').textContent = '契約内容を編集';
  document.getElementById('formDescription').textContent = `${r.name || '選択した契約'}の内容を更新します。`;
  document.querySelector('#saveBtn .button-label').textContent = '更新する';
  updateUI();
  syncMemberLock();
}

function updateUI() {
  const m = form.contract_type.value;
  const s = form.contract_status.value;
  const p = form.payment_method.value;

  document.getElementById('deliverySection').classList.toggle('hidden', m === '電子版');
  document.getElementById('emailField').classList.toggle('hidden',      m === '紙版');
  document.getElementById('bankFields').classList.toggle('hidden',      p !== 'JA口座振替');
  document.getElementById('cancelSection').classList.toggle('hidden',   s === '購読中');

  if (s === '解約予定' && !form.cancel_accept_date.value) {
    form.cancel_accept_date.value = today();
    form.end_date.value           = monthEnd();
  }

  document.getElementById('sumMedia').textContent  = m;
  document.getElementById('sumStatus').textContent = s;
  document.getElementById('sumStart').textContent  = form.start_date.value || '－';
  document.getElementById('sumShop').textContent   = form.delivery_shop.value || '－';
}

// ── 編集対象の読み込み ────────────────────────────────
async function loadRecord(id) {
  try {
    const d = await callGas({ action: 'list' });
    if (!d.ok) throw new Error(d.message);
    const r = (d.records || []).find(x => String(x.id) === String(id));
    if (!r) { show('error', '対象の契約が見つかりませんでした。'); return; }
    fillForm(r);
    // 組合員番号があれば名簿の最新値で再表示＋ロック（名簿が読めない場合は保存値のまま手入力可）
    if (String(r.member_no || '').trim()) await lookupMember();
    formDirty = false;
  } catch(e) {
    show('error', '契約の読み込みに失敗しました。\n' + e.message);
  }
}

// ── events ────────────────────────────────────────────
['contract_type','contract_status','payment_method','start_date','delivery_shop'].forEach(n => {
  form.elements[n].addEventListener('change', updateUI);
  form.elements[n].addEventListener('input',  updateUI);
});

document.getElementById('cancelBtn').onclick = () => { formDirty = false; location.href = 'index.html'; };
document.getElementById('memberLookupBtn').onclick = lookupMember;
form.elements.member_no.addEventListener('change', lookupMember);
form.elements.member_no.addEventListener('input', e => { if (String(e.target.value || '').trim() !== lastMemberLookup.no) lastMemberLookup = { no: '', record: null }; syncMemberLock(); });
form.elements.member_no.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lookupMember(); } });

form.onsubmit = async e => {
  e.preventDefault();
  const memberNo = String(form.elements.member_no.value || '').trim();
  // 組合員番号があるのに未読込なら、保存前に名簿を読み込んで反映
  if (memberNo && !(lastMemberLookup.record && lastMemberLookup.no === memberNo)) await lookupMember();
  if(!form.reportValidity()) return;
  const saveBtn=document.getElementById('saveBtn'); const buttonLabel=saveBtn.querySelector('.button-label'); const originalLabel=buttonLabel.textContent; saveBtn.classList.add('loading'); saveBtn.disabled=true; buttonLabel.textContent = form.record_id.value ? '更新中…' : '登録中…';
  if (lastMemberLookup.record && lastMemberLookup.no === memberNo) applyMemberRecord(lastMemberLookup.record);
  const p = Object.fromEntries(new FormData(form).entries());
  if (lastMemberLookup.record && lastMemberLookup.no === memberNo) mergeMemberRecordPayload(p, lastMemberLookup.record);
  p.action = p.record_id ? 'update' : 'create';
  try {
    const d = await callGas(p);
    if (!d.ok) throw new Error(d.message);
    sessionStorage.setItem('flash', p.action === 'create' ? '登録しました。' : '更新しました。');
    formDirty = false;
    location.href = 'index.html';
  } catch(err) {
    show('error', '保存に失敗しました。\n' + err.message);
    saveBtn.classList.remove('loading'); saveBtn.disabled=false; buttonLabel.textContent=originalLabel;
  }
};

form.addEventListener('input',  () => { formDirty = true; });
form.addEventListener('change', () => { formDirty = true; });
window.addEventListener('beforeunload', e => { if (formDirty) { e.preventDefault(); e.returnValue = ''; } });

// ── init ──────────────────────────────────────────────
initHealthButton();
resetForm();
const editId = new URLSearchParams(location.search).get('id');
if (editId) loadRecord(editId);
