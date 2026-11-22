// scan-core.js — pure helpers for the Scan feature (no network, no DOM rendering).
// Exposed as window.ScanCore so scan.html and tests.html can share it.
(function (global) {
  'use strict';

  // Zones and the default image come from shared/items.js, which must be loaded before this file.
  const ZONES = global.Items.ZONES;

  const SETTINGS_KEY = 'whatsinthefridge.scan.settings.v1';
  const PENDING_KEY = 'whatsinthefridge.scan.pending.v1';

  // Supported recognition providers. Default model IDs can be changed in the page settings.
  const PROVIDERS = {
    openrouter: {
      label: 'OpenRouter',
      // Free + image input on openrouter.ai/models as of 2026-11-22; free models change often.
      defaultModel: 'google/gemma-4-31b-it:free',
      keyPlaceholder: 'sk-or-v1-...',
      keyHelp: 'Get one at openrouter.ai/keys.',
      modelHelp: 'Needs image input and ":free" in the ID — check openrouter.ai/models.'
    },
    gemini: {
      label: 'Google Gemini',
      // Placeholder — check the current model list in Google AI Studio and edit it in settings.
      defaultModel: 'gemini-2.5-flash',
      keyPlaceholder: 'AIza...',
      keyHelp: 'Get one at aistudio.google.com/apikey.',
      modelHelp: 'Model name as shown in Google AI Studio, e.g. gemini-2.5-flash.'
    }
  };
  const DEFAULT_PROVIDER = 'openrouter';
  const DEFAULT_MODEL = PROVIDERS.openrouter.defaultModel;

  const DEFAULT_IMG = global.Items.DEFAULT_IMG;

  const PHOTO_PROMPT = [
    'You are looking at a photo of groceries or the inside of a fridge.',
    'List every distinct food or drink item you can see.',
    'Rules:',
    '- Use short English names (e.g. "Milk", "Eggs", "Broccoli").',
    '- If a brand is clearly readable on the package, put it before the name (e.g. "Arla Milk"). Do not guess brands.',
    '- Each item only once, no quantities, no descriptions.',
    '- Ignore non-food objects (shelves, bags, hands, containers without visible food).',
    'Respond with ONLY a JSON array of strings, e.g. ["Arla Milk","Eggs","Broccoli"]. If you see no food, respond with [].'
  ].join('\n');

  // Turn raw model output into a clean, de-duplicated list of names.
  // Handles: plain JSON, ```json fences, extra prose around the array, arrays of {name} objects.
  function parseNames(text) {
    if (typeof text !== 'string' || !text.trim()) return [];
    let s = text.trim();

    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();

    let arr = tryParse(s);
    if (!Array.isArray(arr)) {
      const start = s.indexOf('[');
      const end = s.lastIndexOf(']');
      if (start !== -1 && end > start) arr = tryParse(s.slice(start, end + 1));
    }
    if (arr && !Array.isArray(arr) && Array.isArray(arr.items)) arr = arr.items;
    if (!Array.isArray(arr)) return [];

    const seen = new Set();
    const out = [];
    for (const el of arr) {
      let name = typeof el === 'string' ? el : (el && typeof el.name === 'string' ? el.name : '');
      name = name.trim().replace(/\s+/g, ' ');
      if (!name || name.length > 80) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }

  function tryParse(s) {
    try { return JSON.parse(s); } catch (e) { return undefined; }
  }

  // Validate edited rows and convert them to items index.html can store.
  // Returns { items, errors } where errors[i] lists problems for row i (empty = ok).
  function buildPendingItems(rows) {
    const items = [];
    const errors = [];
    (Array.isArray(rows) ? rows : []).forEach((row, i) => {
      const name = String(row && row.name || '').trim();
      const zone = String(row && row.zone || '');
      const qty = parseInt(row && row.qty, 10);
      const category = String(row && row.category || '').trim();
      const errs = [];
      if (!name) errs.push('name');
      if (!ZONES.includes(zone)) errs.push('zone');
      errors[i] = errs;
      if (errs.length) return;
      items.push({
        name,
        zone,
        category,
        qty: isNaN(qty) || qty < 1 ? 1 : qty,
        expiry: null,
        img: DEFAULT_IMG
      });
    });
    const ok = errors.every(e => e.length === 0) && items.length > 0;
    return { items, errors, ok };
  }

  // Settings (API key, model) are kept in memory only and are NOT persisted:
  // they are gone when the page is closed, refreshed or left.
  function memoryStore() {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k)
    };
  }
  const sessionSettings = memoryStore();

  // Remove settings saved by older versions (they stored the key in localStorage).
  function purgeStoredSettings(storage = global.localStorage) {
    try { storage.removeItem(SETTINGS_KEY); } catch (e) { /* storage unavailable */ }
  }

  // Stored shape: { provider, providers: { openrouter: {apiKey, model}, gemini: {apiKey, model} } }.
  // Older shape { apiKey, model } is read as OpenRouter settings.
  function readStore(storage) {
    let s;
    try { s = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { s = {}; }
    const providers = {};
    Object.keys(PROVIDERS).forEach(p => {
      const src = (s.providers && s.providers[p]) || (p === 'openrouter' && !s.providers ? s : {}) || {};
      providers[p] = {
        apiKey: typeof src.apiKey === 'string' ? src.apiKey : '',
        model: (typeof src.model === 'string' && src.model) || PROVIDERS[p].defaultModel
      };
    });
    const provider = PROVIDERS[s.provider] ? s.provider : DEFAULT_PROVIDER;
    return { provider, providers };
  }

  // Returns the active provider's settings: { provider, apiKey, model, providers }.
  function loadSettings(storage = sessionSettings) {
    const st = readStore(storage);
    return { provider: st.provider, ...st.providers[st.provider], providers: st.providers };
  }

  // Saves key/model for settings.provider and makes it the active provider.
  function saveSettings(settings, storage = sessionSettings) {
    const st = readStore(storage);
    const provider = PROVIDERS[settings.provider] ? settings.provider : st.provider;
    st.providers[provider] = {
      apiKey: String(settings.apiKey || '').trim(),
      model: String(settings.model || '').trim() || PROVIDERS[provider].defaultModel
    };
    storage.setItem(SETTINGS_KEY, JSON.stringify({ provider, providers: st.providers }));
  }

  // Clears one provider's key/model, or everything when no provider is given.
  function clearSettings(provider, storage = sessionSettings) {
    if (!PROVIDERS[provider]) { storage.removeItem(SETTINGS_KEY); return; }
    const st = readStore(storage);
    st.providers[provider] = { apiKey: '', model: PROVIDERS[provider].defaultModel };
    storage.setItem(SETTINGS_KEY, JSON.stringify({ provider: st.provider, providers: st.providers }));
  }

  // Compute target size keeping aspect ratio; never upscale.
  function fitSize(w, h, maxSide) {
    const longest = Math.max(w, h);
    if (longest <= maxSide) return { width: w, height: h };
    const scale = maxSide / longest;
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  }

  // Draw any image source onto a canvas at most maxSide px and return a JPEG dataURL.
  function compressSource(source, srcW, srcH, maxSide = 1024, quality = 0.85) {
    const { width, height } = fitSize(srcW, srcH, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(source, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  // File/Blob -> compressed JPEG dataURL.
  function compressImage(file, maxSide = 1024, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          resolve(compressSource(img, img.naturalWidth, img.naturalHeight, maxSide, quality));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
      img.src = url;
    });
  }

  // Approximate decoded size of a dataURL in KB (for the debug panel).
  function dataUrlKB(dataUrl) {
    const b64 = String(dataUrl).split(',')[1] || '';
    return Math.round((b64.length * 3) / 4 / 1024);
  }

  global.ScanCore = {
    ZONES, SETTINGS_KEY, PENDING_KEY, PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL, DEFAULT_IMG, PHOTO_PROMPT,
    parseNames, buildPendingItems,
    loadSettings, saveSettings, clearSettings, purgeStoredSettings,
    fitSize, compressSource, compressImage, dataUrlKB
  };
})(window);
