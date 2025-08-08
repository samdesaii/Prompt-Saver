import { getAll } from '../common/storage.js';

const list = document.getElementById('list');
const search = document.getElementById('search');
const scopeSel = document.getElementById('scope');
const pasteInput = document.getElementById('newPromptText');
const saveBtn = document.getElementById('savePasted');

let cache = { global: [], byChat: {}, chatId: null };

init();

async function init() {
  cache = await getCache();
  pasteInput?.focus();
  render();
}

async function getActiveTabChatId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:\/\/(chat\.openai\.com|chatgpt\.com)\//.test(tab.url)) return { tabId: tab?.id ?? null, chatId: null };
  const m = new URL(tab.url).pathname.match(/\/c\/([a-z0-9-]+)/i);
  return { tabId: tab.id, chatId: m ? m[1] : null };
}

async function getCache() {
  const all = await new Promise(resolve => chrome.storage.local.get(null, resolve));
  return {
    global: all.globalPrompts || [],
    byChat: all.chatPrompts || {},
    chatId: (await getActiveTabChatId()).chatId
  };
}

function render() {
  const q = search.value.toLowerCase();
  const scope = scopeSel.value;
  const items = collect(scope).filter(p => p.title.toLowerCase().includes(q) || p.text.toLowerCase().includes(q));
  list.innerHTML = '';
  for (const p of items) list.appendChild(card(p));
}

function collect(scope) {
  const all = [];
  if (scope === 'global' || scope === 'all') all.push(...cache.global.map(x => ({ ...x, scope: 'global' })));
  if (scope === 'this' || scope === 'all') {
    const arr = cache.chatId ? (cache.byChat[cache.chatId] || []) : [];
    all.push(...arr.map(x => ({ ...x, scope: 'chat', chatId: cache.chatId })));
  }
  return all.sort((a,b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function card(p) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <h4>${escapeHtml(p.title || '(untitled)')}</h4>
    <pre>${escapeHtml(p.text)}</pre>
    <div class="row">
      <button data-act="copy">Copy</button>
      <button data-act="insert">Insert</button>
      <button data-act="delete">Delete</button>
    </div>
  `;
  el.querySelector('[data-act="copy"]').addEventListener('click', () => navigator.clipboard.writeText(p.text));
  el.querySelector('[data-act="insert"]').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'insertPrompt', text: p.text }).catch(() => {});
    }
    // Keep window open; user can click back into the page
  });
  el.querySelector('[data-act="delete"]').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'removePrompt', payload: { scope: p.scope === 'global' ? 'global' : 'chat', chatId: p.chatId, id: p.id } });
    cache = await getCache();
    render();
  });
  return el;
}

function escapeHtml(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

search.addEventListener('input', render);
scopeSel.addEventListener('change', render);

// New: save pasted prompt from the popup itself
saveBtn.addEventListener('click', async () => {
  const text = (pasteInput.value || '').trim();
  if (!text) return;

  const { tabId, chatId } = await getActiveTabChatId();

  // Decide target scope based on selector and availability of chatId
  let target = scopeSel.value; // 'this' | 'global' | 'all'
  if (target === 'all') target = chatId ? 'this' : 'global';
  if (target === 'this' && !chatId) target = 'global';

  const prompt = mkPrompt(text);

  const data = await chrome.storage.local.get(['globalPrompts', 'chatPrompts']);
  const globalPrompts = data.globalPrompts || [];
  const chatPrompts = data.chatPrompts || {};

  if (target === 'global') {
    await chrome.storage.local.set({ globalPrompts: [...globalPrompts, prompt] });
  } else {
    const list = chatPrompts[chatId] || [];
    await chrome.storage.local.set({ chatPrompts: { ...chatPrompts, [chatId]: [...list, prompt] } });
  }

  pasteInput.value = '';
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'toast',
      message: `Saved${target === 'global' ? ' globally' : ' to this chat'}`
    }).catch(() => {});
  }

  cache = await getCache();
  render();
});

function mkPrompt(text) {
  const title = text.split('\n').find(Boolean)?.slice(0, 60) || text.slice(0, 60) || '(untitled)';
  return {
    id: (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    title,
    text,
    createdAt: new Date().toISOString()
  };
}