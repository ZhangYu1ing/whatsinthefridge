// storage.js — the only place that reads or writes fridge items.
// Every function is async, so callers keep working unchanged when localStorage is swapped for a server.
// Exposed as window.ItemStore; requires items.js to be loaded first.
(function (global) {
  'use strict';

  const { normalizeItem, isValidItem } = global.Items;
  const KEY = 'whatsinthefridge.items.v1';

  // Sample data used until the first change is saved.
  const SEED_ITEMS = [
    { id: 1, name: 'Whole Organic Milk', zone: 'chilled', category: 'Dairy', qty: 2, expiry: '2026-11-30', img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=400&auto=format&fit=crop' },
    { id: 2, name: 'Fresh Avocados', zone: 'pantry', category: 'Produce', qty: 4, expiry: '2026-11-25', img: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?q=80&w=400&auto=format&fit=crop' },
    { id: 3, name: 'Grass-Fed Ribeye Steak', zone: 'freezer', category: 'Meat', qty: 1, expiry: '2027-05', img: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?q=80&w=400&auto=format&fit=crop' },
    { id: 4, name: 'Artisan Sourdough Bread', zone: 'outside', category: 'Pantry', qty: 1, expiry: '2026-11-24', img: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?q=80&w=400&auto=format&fit=crop' },
    { id: 5, name: 'Greek Yogurt (Plain)', zone: 'chilled', category: 'Dairy', qty: 3, expiry: '2026-12-05', img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=400&auto=format&fit=crop' },
    { id: 6, name: 'Organic Cherry Tomatoes', zone: 'pantry', category: 'Produce', qty: 2, expiry: '2026-11-26', img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?q=80&w=400&auto=format&fit=crop' }
  ];

  function readAll() {
    try {
      const raw = global.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(normalizeItem);
      }
    } catch (e) {
      console.warn('Could not read saved items, using defaults.', e);
    }
    return SEED_ITEMS.map(normalizeItem);
  }

  // Throws when the browser refuses to store (e.g. quota exceeded by large photos).
  function writeAll(items) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      throw new Error('Browser storage is full or unavailable.');
    }
  }

  function nextId(items) {
    return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  }

  async function getAll() {
    return readAll();
  }

  // Adds every valid item in one write; invalid ones are skipped. Returns the items that were added.
  async function addMany(rawItems) {
    const items = readAll();
    const added = [];
    rawItems.forEach(raw => {
      const item = normalizeItem(raw || {});
      if (!isValidItem(item)) return;
      item.id = nextId(items);
      items.push(item);
      added.push(item);
    });
    if (added.length) writeAll(items);
    return added;
  }

  async function add(raw) {
    const added = await addMany([raw]);
    if (!added.length) throw new Error('Item needs a name and a valid storage zone.');
    return added[0];
  }

  async function update(raw) {
    const items = readAll();
    const idx = items.findIndex(item => item.id === raw.id);
    if (idx === -1) throw new Error('Item not found.');
    const item = normalizeItem(raw);
    if (!isValidItem(item)) throw new Error('Item needs a name and a valid storage zone.');
    items[idx] = item;
    writeAll(items);
    return item;
  }

  async function remove(id) {
    const items = readAll();
    const kept = items.filter(item => item.id !== id);
    if (kept.length !== items.length) writeAll(kept);
  }

  global.ItemStore = { KEY, getAll, add, addMany, update, remove };
})(window);
