// ── 契約一覧（index.html） ──
const state = { records: [] };
const listBody = document.getElementById('listBody');

// ── render table ──────────────────────────────────────
function render(rs) {
  listBody.innerHTML = '';
  document.getElementById('empty').classList.toggle('hidden', rs.length > 0);
  document.getElementById('resultCount').textContent = `${rs.length}件`;
  rs.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="table-name" data-label="氏名">${esc(r.name || '氏名未設定')}</td>
      <td data-label="電話番号">${esc(r.phone || '－')}</td>
      <td class="table-address" data-label="住所" title="${esc(r.address || '')}">${esc(r.address || '－')}</td>
      <td data-label="媒体">${esc(r.contract_type || '－')}</td>
      <td data-label="状態"><span class="badge badge-${esc(r.contract_status)}">${esc(r.contract_status || '－')}</span></td>
      <td data-label="開始日">${esc(r.start_date || '－')}</td>
      <td data-label="終了日">${esc(r.end_date || '－')}</td>
      <td data-label="販売店">${esc(r.delivery_shop || '－')}</td>
      <td data-label="支払方法">${esc(r.payment_method || '－')}</td>
      <td data-label="操作"><div class="row-actions"><button class="btn-secondary" data-action="edit" data-id="${esc(r.id)}">編集</button><button class="btn-danger" data-action="delete" data-id="${esc(r.id)}">削除</button></div></td>`;
    listBody.appendChild(tr);
  });
}

// ── filter ────────────────────────────────────────────
function filter() {
  const q = document.getElementById('keyword').value.toLowerCase();
  const s = document.getElementById('statusFilter').value;
  const m = document.getElementById('mediaFilter').value;
  render(state.records.filter(r =>
    (!q || [r.name, r.address, r.phone, r.delivery_shop, r.member_no].some(v => String(v || '').toLowerCase().includes(q))) &&
    (!s || r.contract_status === s) &&
    (!m || r.contract_type   === m)
  ));
}

// ── load ──────────────────────────────────────────────
async function load() {
  try {
    const d = await callGas({ action: 'list' });
    if (!d.ok) throw new Error(d.message);
    state.records = d.records || [];
    filter();
  } catch(e) {
    show('error', '一覧取得に失敗しました。\n' + e.message);
  }
}

// ── 編集画面へ遷移 ────────────────────────────────────
function goEdit(id) { location.href = `edit.html?id=${encodeURIComponent(id)}`; }

// ── delete ────────────────────────────────────────────
async function del(id) {
  const r = state.records.find(x => String(x.id) === String(id));
  if (!confirm(`「${r?.name || id}」を削除しますか？`)) return;
  try {
    const d = await callGas({ action: 'delete', record_id: id });
    if (!d.ok) throw new Error(d.message);
    show('ok', '削除しました。');
    await load();
  } catch(e) {
    show('error', '削除に失敗しました。\n' + e.message);
  }
}

// ── events ────────────────────────────────────────────
document.getElementById('keyword').oninput = e => { document.getElementById('clearSearchBtn').classList.toggle('hidden', !e.target.value); filter(); };
document.getElementById('clearSearchBtn').onclick = () => { const input=document.getElementById('keyword'); input.value=''; document.getElementById('clearSearchBtn').classList.add('hidden'); input.focus(); filter(); };
document.getElementById('clearFiltersBtn').onclick = () => { document.getElementById('statusFilter').value=''; document.getElementById('mediaFilter').value=''; filter(); };
document.getElementById('statusFilter').onchange = filter;
document.getElementById('mediaFilter').onchange  = filter;
document.getElementById('reloadBtn').onclick     = load;

listBody.onclick = e => {
  const b = e.target.closest('button[data-action]');
  if (b) {
    b.dataset.action === 'edit' ? goEdit(b.dataset.id) : del(b.dataset.id);
    return;
  }
  const row = e.target.closest('tr[data-id]');
  if (row?.dataset.id) goEdit(row.dataset.id);
};

// ── init ──────────────────────────────────────────────
initHealthButton();
const flash = sessionStorage.getItem('flash');
if (flash) { sessionStorage.removeItem('flash'); show('ok', flash); }
load();
