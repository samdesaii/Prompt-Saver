import { saveGlobal, saveForChat, removePrompt } from './common/storage.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveSelectionAsPrompt',
    title: 'Save selection as prompt',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveSelectionAsPrompt' && info.selectionText) {
    const chatId = await getChatIdFromTab(tab.id);
    const prompt = mkPrompt(info.selectionText);
    if (chatId) await saveForChat(chatId, prompt); else await saveGlobal(prompt);
    notify(tab.id, `Saved${chatId ? ' to this chat' : ''}!`);
  }
});

function mkPrompt(text) {
  return {
    id: crypto.randomUUID(),
    title: text.slice(0, 60),
    text,
    createdAt: new Date().toISOString()
  };
}

async function getChatIdFromTab(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const m = location.pathname.match(/\/c\/([a-z0-9-]+)/i);
        return m ? m[1] : null;
      }
    });
    return result;
  } catch {
    return null;
  }
}

function notify(tabId, message) {
  chrome.tabs.sendMessage(tabId, { type: 'toast', message }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'savePrompt') {
    const { text, chatId } = msg;
    const prompt = mkPrompt(text);
    (chatId ? saveForChat(chatId, prompt) : saveGlobal(prompt)).then(() => sendResponse({ ok: true, prompt }));
    return true; // async
  }
  if (msg?.type === 'removePrompt') {
    removePrompt(msg.payload).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Persistent popout window for the popup UI
let popoutWindowId = null;

async function openOrFocusPopout() {
  try {
    if (popoutWindowId != null) {
      await chrome.windows.get(popoutWindowId);
      await chrome.windows.update(popoutWindowId, { focused: true, drawAttention: true });
      return;
    }
  } catch {
    // missing
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('popup/popup.html'),
    type: 'popup',
    width: 380,
    height: 600
  });
  popoutWindowId = win.id;
}

chrome.action.onClicked.addListener(openOrFocusPopout);

chrome.windows.onRemoved.addListener((id) => {
  if (id === popoutWindowId) popoutWindowId = null;
});