// items.js — shared rules for fridge items: zones, defaults, expiry dates.
// No DOM and no storage here. Exposed as window.Items; load it before storage.js and the page scripts.
(function (global) {
  'use strict';

  const ZONE_NAMES = { chilled: 'Cold Store', pantry: 'Pantry', freezer: 'Freezer', outside: 'Outside Fridge' };
  const ZONES = Object.keys(ZONE_NAMES);
  const DEFAULT_IMG = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop';
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SOON_DAYS = 3;

  // Expiry is stored as 'YYYY-MM-DD', 'YYYY-MM' (day unknown) or null (no expiry).
  const EXPIRY_PATTERN = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

  // Returns the value unchanged if it is a real date in the stored format, otherwise null.
  function normalizeExpiry(value) {
    const m = typeof value === 'string' ? EXPIRY_PATTERN.exec(value) : null;
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    if (m[3] && (Number(m[3]) < 1 || Number(m[3]) > new Date(year, month, 0).getDate())) return null;
    return value;
  }

  // Display text for a stored expiry value.
  function formatExpiry(value) {
    const valid = normalizeExpiry(value);
    if (!valid) return 'No expiry set';
    const [, y, mo, d] = EXPIRY_PATTERN.exec(valid);
    const month = MONTH_NAMES[Number(mo) - 1];
    return d ? `Expiry: ${month} ${Number(d)}, ${y}` : `Expiry: ${month} ${y}`;
  }

  // Days from today until expiry (negative = already expired); null if there is no valid date.
  // A month-only value counts as the last day of that month.
  function daysUntilExpiry(value) {
    const valid = normalizeExpiry(value);
    if (!valid) return null;
    const [, y, mo, d] = EXPIRY_PATTERN.exec(valid);
    const lastDay = d ? Number(d) : new Date(Number(y), Number(mo), 0).getDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((new Date(Number(y), Number(mo) - 1, lastDay) - today) / 86400000);
  }

  // Soonest expiry first, items without an expiry last. ISO date strings sort correctly as text.
  function sortByExpiry(items) {
    return [...items].sort((a, b) => {
      if (!a.expiry) return b.expiry ? 1 : 0;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });
  }

  // Clean an item from any source (storage, scan hand-off, forms): trim, default and validate fields.
  function normalizeItem(raw) {
    const qty = parseInt(raw.qty, 10);
    return {
      id: raw.id,
      name: String(raw.name ?? '').trim(),
      zone: raw.zone,
      category: typeof raw.category === 'string' ? raw.category : '',
      qty: Number.isNaN(qty) || qty < 0 ? 1 : qty,
      expiry: normalizeExpiry(raw.expiry),
      img: typeof raw.img === 'string' && raw.img ? raw.img : DEFAULT_IMG
    };
  }

  function isValidItem(item) {
    return item.name !== '' && ZONES.includes(item.zone);
  }

  global.Items = {
    ZONES, ZONE_NAMES, DEFAULT_IMG, MONTH_NAMES, SOON_DAYS,
    normalizeExpiry, formatExpiry, daysUntilExpiry, sortByExpiry,
    normalizeItem, isValidItem
  };
})(window);
