// main.js — home page startup. Loaded last, after every other script in home/.

// Initialize Vector Icons
lucide.createIcons();

// Set Dynamic Date (Standard English Format)
const dateFormat = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateFormat);

// Scan: opens the standalone page in scan/
document.getElementById('open-scan').addEventListener('click', () => {
  location.href = 'scan/scan.html';
});

// Import items handed over by scan/scan.html (stored under a temporary key, then removed).
const SCAN_PENDING_KEY = 'whatsinthefridge.scan.pending.v1';

// Returns how many items were imported.
async function importPendingScan() {
  let pending;
  try {
    pending = JSON.parse(localStorage.getItem(SCAN_PENDING_KEY) || 'null');
  } catch (e) {
    pending = null;
  }
  localStorage.removeItem(SCAN_PENDING_KEY); // remove first so a refresh never imports twice
  if (!Array.isArray(pending)) return 0;

  let added = [];
  await tryStore(async () => { added = await ItemStore.addMany(pending); });
  return added.length;
}

// Startup: take in scanned items, load data, then render the home page.
async function init() {
  const imported = await importPendingScan();
  await reloadItems();
  updateExpiryAlert();
  // After returning from scan/scan.html with new items, show them.
  if (imported) selectCategory('all');
  document.body.dataset.ready = 'true'; // signal for the automated tests
}
init();
