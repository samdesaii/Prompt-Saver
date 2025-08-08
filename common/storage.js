export const KEYS = {
  GLOBAL: 'globalPrompts',
  BY_CHAT: 'chatPrompts' // object: { [chatId]: Prompt[] }
};

export function nowIso() { return new Date().toISOString(); }

export async function getAll() {
  return new Promise(resolve => {
    chrome.storage.local.get([KEYS.GLOBAL, KEYS.BY_CHAT], data => {
      resolve({
        global: data[KEYS.GLOBAL] || [],
        byChat: data[KEYS.BY_CHAT] || {}
      });
    });
  });
}

export async function saveGlobal(prompt) {
  const all = await getAll();
  const next = [...all.global, prompt];
  return new Promise(resolve => {
    chrome.storage.local.set({ [KEYS.GLOBAL]: next }, resolve);
  });
}

export async function saveForChat(chatId, prompt) {
  const all = await getAll();
  const list = all.byChat[chatId] || [];
  const next = { ...all.byChat, [chatId]: [...list, prompt] };
  return new Promise(resolve => {
    chrome.storage.local.set({ [KEYS.BY_CHAT]: next }, resolve);
  });
}

export async function removePrompt({ scope, chatId, id }) {
  const all = await getAll();
  if (scope === 'global') {
    const next = all.global.filter(p => p.id !== id);
    return chrome.storage.local.set({ [KEYS.GLOBAL]: next });
  }
  const list = (all.byChat[chatId] || []).filter(p => p.id !== id);
  return chrome.storage.local.set({ [KEYS.BY_CHAT]: { ...all.byChat, [chatId]: list } });
}

export async function exportJson() {
  const data = await getAll();
  return JSON.stringify(data, null, 2);
}

export async function importJson(json) {
  const parsed = JSON.parse(json);
  const global = Array.isArray(parsed.global) ? parsed.global : [];
  const byChat = typeof parsed.byChat === 'object' && parsed.byChat ? parsed.byChat : {};
  return chrome.storage.local.set({ [KEYS.GLOBAL]: global, [KEYS.BY_CHAT]: byChat });
}