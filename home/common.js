// common.js — state and helpers used by several home page scripts.
// Load order is set in index.html: shared/items.js and shared/storage.js come first.

// In-memory copy used for rendering; refreshed from ItemStore after every change.
let inventoryData = [];

async function reloadItems() {
  inventoryData = await ItemStore.getAll();
}

// Runs a data-layer call; on failure (e.g. browser storage full) shows a message instead of breaking the UI.
async function tryStore(action) {
  try {
    await action();
    return true;
  } catch (e) {
    console.error(e);
    alert('Could not save changes: ' + e.message);
    return false;
  }
}

// Escape user-provided text before inserting it into innerHTML.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Text color and short label for an item's expiry status.
function expiryStatus(value) {
  const days = Items.daysUntilExpiry(value);
  if (days === null) return { cls: 'text-zinc-500', label: '' };
  if (days < 0) return { cls: 'text-red-400', label: 'Expired' };
  if (days === 0) return { cls: 'text-amber-400', label: 'Today' };
  if (days <= Items.SOON_DAYS) return { cls: 'text-amber-400', label: `${days} day${days > 1 ? 's' : ''} left` };
  return { cls: 'text-emerald-400', label: '' };
}
