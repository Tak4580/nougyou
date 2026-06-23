// ── 共通設定・ヘルパー（index.html / edit.html 共用） ──
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzICttdhhYIgvSkh0its-_mCP1qq5LaTS-9Oe4ScxqoU5vVnHmYU9SNv1QbOzaPdOJekA/exec';

const today    = () => new Date().toLocaleDateString('sv-SE');
const month5   = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-05`; };
const monthEnd = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth()+1, 0).toLocaleDateString('sv-SE'); };
const esc = v => String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));

const result = document.getElementById('result');
function show(type, msg) {
  if (!result) return;
  result.className = type; result.textContent = msg;
  result.scrollIntoView({ behavior:'smooth', block:'nearest' });
  clearTimeout(show._timer);
  show._timer = setTimeout(() => { if (result.className === type) clearMsg(); }, type === 'ok' ? 3600 : 8000);
}
function clearMsg() { if (result) { result.className = ''; result.textContent = ''; } }

async function callGas(payload) {
  const res  = await fetch(GAS_WEB_APP_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload), redirect:'follow' });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('GASからJSON以外の応答が返りました。'); }
}

// 接続確認ボタン（両画面のヘッダーに存在）
function initHealthButton() {
  const btn = document.getElementById('healthBtn');
  if (!btn) return;
  btn.onclick = async () => {
    btn.classList.remove('error'); btn.classList.add('checking'); btn.disabled = true;
    try {
      const d = await callGas({ action: 'health' });
      if (!d.ok) throw new Error(d.message);
      show('ok', d.message);
    } catch(e) { btn.classList.add('error'); show('error', e.message); }
    finally { btn.classList.remove('checking'); btn.disabled = false; }
  };
}
