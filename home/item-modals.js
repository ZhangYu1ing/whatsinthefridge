// item-modals.js — the "Add to Fridge" and "Edit / Move" dialogs.
// Needs createExpiryPicker (expiry-picker.js), selectCategory / refreshCurrentView (inventory.js).
const addExpiry = createExpiryPicker('add');
const editExpiry = createExpiryPicker('edit');

// ---------- Add item ----------
const addItemModal = document.getElementById('add-item-modal');
const addTabs = document.querySelectorAll('.add-tab');
const addPanels = document.querySelectorAll('.add-panel');
const uploadInput = document.getElementById('upload-input');
const uploadPreview = document.getElementById('upload-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');
let addImgData = '';

function openAddItem() {
  closeDrawer();
  resetAddItem();
  addItemModal.classList.remove('hidden');
  addItemModal.classList.add('flex');
  lucide.createIcons();
}

function closeAddItem() {
  addItemModal.classList.add('hidden');
  addItemModal.classList.remove('flex');
}

function resetAddItem() {
  document.getElementById('add-name').value = '';
  document.getElementById('add-qty').value = 1;
  document.getElementById('add-zone').value = 'chilled';
  addExpiry.reset();
  uploadInput.value = '';
  addImgData = '';
  uploadPreview.src = '';
  uploadPreview.classList.add('hidden');
  uploadPlaceholder.classList.remove('hidden');
  switchAddMethod('upload');
}

function switchAddMethod(method) {
  addTabs.forEach(tab => {
    const active = tab.dataset.method === method;
    tab.classList.toggle('bg-emerald-600', active);
    tab.classList.toggle('text-white', active);
    tab.classList.toggle('bg-zinc-800', !active);
    tab.classList.toggle('text-zinc-300', !active);
  });
  addPanels.forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== method);
  });
}

addTabs.forEach(tab => {
  tab.addEventListener('click', () => switchAddMethod(tab.dataset.method));
});

uploadInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    addImgData = ev.target.result;
    uploadPreview.src = addImgData;
    uploadPreview.classList.remove('hidden');
    uploadPlaceholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

document.getElementById('close-add-item').addEventListener('click', closeAddItem);

document.getElementById('save-add-item').addEventListener('click', async () => {
  const name = document.getElementById('add-name').value.trim();
  const zone = document.getElementById('add-zone').value;
  const expiry = addExpiry.getValue();
  const qtyVal = parseInt(document.getElementById('add-qty').value, 10);

  if (!name) {
    alert('Please enter an item name.');
    return;
  }

  const saved = await tryStore(() => ItemStore.add({
    name,
    zone,
    category: '',
    qty: isNaN(qtyVal) || qtyVal < 1 ? 1 : qtyVal,
    expiry,
    img: addImgData
  }));
  if (!saved) return;

  await reloadItems();
  closeAddItem();
  selectCategory('all');
  updateExpiryAlert();
});

// ---------- Edit / move item ----------
const editItemModal = document.getElementById('edit-item-modal');
let editingId = null;

function openEditItem(id) {
  const item = inventoryData.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('edit-name').value = item.name;
  document.getElementById('edit-qty').value = item.qty ?? 1;
  editExpiry.load(item.expiry);
  document.getElementById('edit-zone').value = item.zone;
  editItemModal.classList.remove('hidden');
  editItemModal.classList.add('flex');
  lucide.createIcons();
}

function closeEditItem() {
  editItemModal.classList.add('hidden');
  editItemModal.classList.remove('flex');
  editingId = null;
}

document.getElementById('close-edit-item').addEventListener('click', closeEditItem);

document.getElementById('save-edit-item').addEventListener('click', async () => {
  const item = inventoryData.find(i => i.id === editingId);
  if (!item) return;

  const name = document.getElementById('edit-name').value.trim();
  if (!name) {
    alert('Please enter an item name.');
    return;
  }
  const qtyVal = parseInt(document.getElementById('edit-qty').value, 10);

  const saved = await tryStore(() => ItemStore.update({
    ...item,
    name,
    qty: isNaN(qtyVal) || qtyVal < 0 ? 1 : qtyVal,
    expiry: editExpiry.getValue(),
    zone: document.getElementById('edit-zone').value
  }));
  if (!saved) return;

  await reloadItems();
  closeEditItem();
  refreshCurrentView();
});

document.getElementById('delete-edit-item').addEventListener('click', async () => {
  if (editingId == null) return;
  if (!confirm('Remove this item from the fridge?')) return;
  const removed = await tryStore(() => ItemStore.remove(editingId));
  if (!removed) return;

  await reloadItems();
  closeEditItem();
  refreshCurrentView();
});
