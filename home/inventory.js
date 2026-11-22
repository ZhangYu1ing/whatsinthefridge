// inventory.js — the storage-zone views (All Storage, Cold Store, Freezer, Outside Fridge).
const inventoryModal = document.getElementById('inventory-modal');
const closeInventoryBtn = document.getElementById('close-inventory');
const viewTitle = document.getElementById('view-title');
const inventoryGrid = document.getElementById('inventory-grid');
const coldStoreShelves = document.getElementById('coldstore-shelves');
const shelfChilled = document.getElementById('shelf-chilled');
const shelfPantry = document.getElementById('shelf-pantry');

let currentZone = 'all';

function selectCategory(zone) {
  closeDrawer();
  inventoryModal.classList.remove('hidden');
  inventoryModal.classList.add('flex');

  currentZone = zone;

  if (zone === 'chilled') {
    // Cold Store: two shelves — chilled on top, pantry below
    viewTitle.textContent = 'Cold Store';
    inventoryGrid.classList.add('hidden');
    coldStoreShelves.classList.remove('hidden');
    renderShelf(shelfChilled, 'shelf-chilled-empty', inventoryData.filter(i => i.zone === 'chilled'));
    renderShelf(shelfPantry, 'shelf-pantry-empty', inventoryData.filter(i => i.zone === 'pantry'));
    lucide.createIcons();
    return;
  }

  // Other views: single grid
  coldStoreShelves.classList.add('hidden');
  inventoryGrid.classList.remove('hidden');

  let filteredItems = inventoryData;
  let titleText = 'All Storage';

  if (zone === 'freezer') {
    filteredItems = inventoryData.filter(i => i.zone === 'freezer');
    titleText = 'Freezer Zone';
  } else if (zone === 'outside') {
    filteredItems = inventoryData.filter(i => i.zone === 'outside');
    titleText = 'Outside Fridge';
  }

  viewTitle.textContent = titleText;
  renderGrid(filteredItems);
}

// Re-render the current view (used after an edit/move)
function refreshCurrentView() {
  selectCategory(currentZone);
  updateExpiryAlert();
}

// Build a single item card. `editable` controls qty badge + edit button.
function itemCard(item, editable) {
  const status = expiryStatus(item.expiry);
  return `
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all">
      <div class="h-44 w-full bg-zinc-950 relative overflow-hidden">
        <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" class="w-full h-full object-cover">
        <span class="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/10">
          ${escapeHtml(item.zone)}
        </span>
        ${editable ? `
        <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600/90 text-white shadow">
          x${escapeHtml(item.qty ?? 1)}
        </span>` : ''}
      </div>
      <div class="p-4 space-y-2">
        <h4 class="font-semibold text-white">${escapeHtml(item.name)}</h4>
        <p class="text-xs ${status.cls} font-medium">${escapeHtml(Items.formatExpiry(item.expiry) + (status.label ? ' · ' + status.label : ''))}</p>
        ${editable ? `
        <button onclick="openEditItem(${item.id})" class="w-full mt-2 flex items-center justify-center space-x-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-all">
          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          <span>Edit / Move</span>
        </button>` : ''}
      </div>
    </div>
  `;
}

function renderGrid(items) {
  inventoryGrid.innerHTML = Items.sortByExpiry(items).map(item => itemCard(item, true)).join('');
  lucide.createIcons();
}

// Render a shelf inside the Cold Store two-shelf layout (always editable)
function renderShelf(container, emptyId, items) {
  container.innerHTML = Items.sortByExpiry(items).map(item => itemCard(item, true)).join('');
  document.getElementById(emptyId).classList.toggle('hidden', items.length !== 0);
}

closeInventoryBtn.addEventListener('click', () => {
  inventoryModal.classList.add('hidden');
  inventoryModal.classList.remove('flex');
});
