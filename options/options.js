import { exportJson, importJson } from '../common/storage.js';

const dump = document.getElementById('dump');
const file = document.getElementById('file');

document.getElementById('export').addEventListener('click', async () => {
  dump.value = await exportJson();
});

document.getElementById('import').addEventListener('click', async () => {
  const text = await readSelectedFile();
  if (!text) return;
  try {
    await importJson(text);
    alert('Imported!');
  } catch (e) {
    alert('Invalid JSON: ' + e.message);
  }
});

function readSelectedFile() {
  return new Promise(resolve => {
    const f = file.files?.[0];
    if (!f) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(f);
  });
}