Prompt Saver — a dead-simple way to reuse your best prompts
Tired of digging through old chats to find that one perfect prompt? Prompt Saver lets you stash, reuse, and auto-insert prompts right inside ChatGPT.

What you see in the UI (screenshot above):

Scope switcher — choose This chat, Global, or All to filter your saved prompts.

Editor box + Save — paste/type a prompt and hit Save prompt.

Export/Import — back up your prompts or move them to another browser.

Prompt cards — each saved prompt shows:

Copy (copies to clipboard),

Insert (drops the text straight into the ChatGPT message box),

Delete (remove it from storage).

It’s built to be fast and frictionless: if you’re in the middle of a conversation, hit Insert and you’re typing on top of a proven template in seconds.

How it works (tech bits)
Chrome Extension (Manifest V3)

contentScript.js injects the “Insert” behavior and targets the ChatGPT textbox.

popup.html/js renders the mini-UI you see in the screenshot.

chrome.storage.sync (or local) stores prompts.

Per-chat prompts are keyed to the conversation;

Global prompts are available everywhere.

Export/Import serializes your prompts to JSON for easy backup/sharing.

Vanilla HTML/CSS/JS — no heavy frameworks, so it’s easy to read and modify.

Install from the repo
Clone or download: https://github.com/samdesaii/Prompt-Saver

Go to chrome://extensions → toggle Developer mode.

Click Load unpacked → select the project folder.

Pin the extension. Open ChatGPT and start saving prompts.



Contribute / make it bigger
Fork the repo → create a feature branch → PR back to main.

Open Issues for bugs/ideas; tag with feature, bug, or help wanted.

Consider adding:

Folders/tags for prompts

Keyboard shortcuts (e.g., insert last used prompt)

Cloud sync options beyond chrome.storage

Multi-model support (Claude, Gemini, etc.)

Team sharing (export link or gist integration)

If you improve it, please PR—this can grow into a lightweight, cross-site prompt library that actually stays out of your way.
