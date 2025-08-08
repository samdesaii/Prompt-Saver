// contentScript.js

// Track last selection inside contenteditable to restore caret later
let __lastCERange = null;
document.addEventListener('selectionchange', () => {
  const ae = document.activeElement;
  if (ae && ae.isContentEditable) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      __lastCERange = sel.getRangeAt(0).cloneRange();
    }
  }
});

function toast(message) {
  const id = 'cgpt-prompt-saver-toast';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      padding: '10px 12px',
      background: '#111',
      color: '#fff',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 1000000,
      opacity: '0.95'
    });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 1500);
}

// Helpers to find the ChatGPT composer (prefer ProseMirror contenteditable)
const COMPOSER_SEL = [
  '#prompt-textarea.ProseMirror',
  '#prompt-textarea[contenteditable="true"]',
  'div.ProseMirror[contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]'
].join(',');

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
}

function getComposer() {
  let el = document.querySelector(COMPOSER_SEL);
  if (el && isVisible(el)) return { el, type: 'ce' };
  const ta = document.querySelector('textarea');
  if (ta && isVisible(ta)) return { el: ta, type: 'ta' };
  el = document.querySelector('[contenteditable="true"]');
  if (el && isVisible(el)) return { el, type: 'ce' };
  return null;
}

// Input event helpers to improve compatibility with ProseMirror
function inputTypeForText(text) {
  return /\r?\n/.test(text) ? 'insertFromPaste' : 'insertText';
}

function dispatchBeforeInput(el, text) {
  const inputType = inputTypeForText(text);
  let evt;
  try {
    evt = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      data: text
    });
  } catch (_) {
    evt = new Event('beforeinput', { bubbles: true, cancelable: true, composed: true });
    // @ts-ignore
    evt.data = text;
    // @ts-ignore
    evt.inputType = inputType;
  }
  el.dispatchEvent(evt);
  return evt;
}

function dispatchInput(el, text) {
  const inputType = inputTypeForText(text);
  let evt;
  try {
    evt = new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType,
      data: text
    });
  } catch (_) {
    evt = new Event('input', { bubbles: true, composed: true });
    // @ts-ignore
    evt.data = text;
    // @ts-ignore
    evt.inputType = inputType;
  }
  el.dispatchEvent(evt);
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return range;
}

// Handle messages from background/popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'toast' && msg.message) {
    toast(msg.message);
    return;
  }
  if (msg?.type === 'insertPrompt' && typeof msg.text === 'string') {
    const text = msg.text;
    const target = getComposer();

    if (!target) {
      toast('Could not find the input box');
      return;
    }

    if (target.type === 'ta') {
      const ta = target.el;
      const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
      const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : ta.value.length;
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      const prevScroll = ta.scrollTop;
      ta.value = `${before}${text}${after}`;
      const caret = start + text.length;
      ta.selectionStart = ta.selectionEnd = caret;
      ta.scrollTop = prevScroll;
      ta.focus();
      // Dispatch richer input event so frameworks react properly
      dispatchInput(ta, text);
      toast('Inserted prompt');
      return;
    }

    // Contenteditable (ProseMirror)
    const ce = target.el;
    ce.focus();

    // Restore last known selection if available, else place at end
    const sel = window.getSelection();
    if (__lastCERange) {
      sel.removeAllRanges();
      sel.addRange(__lastCERange);
    } else if (!sel || sel.rangeCount === 0) {
      __lastCERange = placeCaretAtEnd(ce);
    }

    // Prefer execCommand so ProseMirror treats it as user input
    let usedExec = false;
    try {
      if (typeof document.execCommand === 'function') {
        usedExec = document.execCommand('insertText', false, text);
      }
    } catch (_) { /* ignore */ }

    if (!usedExec) {
      // Signal beforeinput for editors that listen to it
      dispatchBeforeInput(ce, text);

      const sel2 = window.getSelection();
      if (sel2 && sel2.rangeCount > 0) {
        const range = sel2.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        // Move caret to after inserted node
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel2.removeAllRanges();
        sel2.addRange(range);
        __lastCERange = range.cloneRange();
      } else {
        ce.textContent = (ce.textContent || '') + text;
        __lastCERange = placeCaretAtEnd(ce);
      }
      // Notify editor that content changed
      dispatchInput(ce, text);
    }

    toast('Inserted prompt');
  }
});

// Popup is the sole UI; no auto-injected side panel.
