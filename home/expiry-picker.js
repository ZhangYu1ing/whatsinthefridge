// expiry-picker.js — year / month / day selectors (day optional) used by the add and edit modals.
const YEARS_AHEAD = 6;

// `prefix` is 'add' or 'edit' and picks the matching element ids in the HTML.
function createExpiryPicker(prefix) {
  const yearSel = document.getElementById(`${prefix}-expiry-year`);
  const monthSel = document.getElementById(`${prefix}-expiry-month`);
  const daySel = document.getElementById(`${prefix}-expiry-day`);
  const noChk = document.getElementById(`${prefix}-no-expiry`);
  let floor = { y: 0, m: 0, d: 0 };   // earliest selectable date

  function fillYears(lastYear) {
    yearSel.innerHTML = '';
    for (let y = floor.y; y <= lastYear; y++) {
      yearSel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
    }
  }

  function fillMonths(want) {
    const start = Number(yearSel.value) === floor.y ? floor.m : 1;
    const keep = want ?? Number(monthSel.value);
    monthSel.innerHTML = '';
    for (let m = start; m <= 12; m++) {
      monthSel.insertAdjacentHTML('beforeend', `<option value="${m}">${Items.MONTH_NAMES[m - 1]}</option>`);
    }
    if (keep >= start && keep <= 12) monthSel.value = keep;
    fillDays();
  }

  function fillDays() {
    const y = Number(yearSel.value);
    const m = Number(monthSel.value);
    const daysInMonth = new Date(y, m, 0).getDate();
    const start = (y === floor.y && m === floor.m) ? floor.d : 1;
    const keep = daySel.value;
    daySel.innerHTML = '<option value="">— (no day)</option>';
    for (let d = start; d <= daysInMonth; d++) {
      daySel.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`);
    }
    daySel.value = (keep !== '' && Number(keep) >= start && Number(keep) <= daysInMonth) ? keep : '';
  }

  function applyNoExpiry() {
    yearSel.disabled = monthSel.disabled = daySel.disabled = noChk.checked;
  }

  // Parse 'YYYY-MM-DD' or 'YYYY-MM'; returns null for null or old free-text values.
  function parse(value) {
    const m = typeof value === 'string' ? /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value) : null;
    return m ? { y: Number(m[1]), m: Number(m[2]), d: m[3] ? Number(m[3]) : null } : null;
  }

  // Past dates are not selectable, except the item's own existing date when editing.
  function setup(parsed, noExpiry) {
    const now = new Date();
    const today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    floor = today;
    if (parsed) {
      const key = (p, day) => p.y * 10000 + p.m * 100 + day;
      if (key(parsed, parsed.d ?? 31) < key(today, today.d)) floor = { y: parsed.y, m: parsed.m, d: 1 };
    }
    fillYears(Math.max(today.y + YEARS_AHEAD, parsed ? parsed.y : 0));
    yearSel.value = parsed ? parsed.y : today.y;
    fillMonths(parsed ? parsed.m : undefined);
    daySel.value = parsed && parsed.d ? String(parsed.d) : '';
    noChk.checked = noExpiry;
    applyNoExpiry();
  }

  noChk.addEventListener('change', applyNoExpiry);
  yearSel.addEventListener('change', () => fillMonths());
  monthSel.addEventListener('change', fillDays);

  return {
    // New item: today, expiry enabled.
    reset() { setup(null, false); },
    // Existing item: fill from the stored value; null or old free text shows "No expiry date".
    load(value) {
      const parsed = parse(value);
      setup(parsed, !parsed);
    },
    // Stored value: 'YYYY-MM-DD', 'YYYY-MM' (day unknown) or null (no expiry).
    getValue() {
      if (noChk.checked) return null;
      const y = yearSel.value;
      const m = monthSel.value;
      if (!y || !m) return null;
      const mm = String(m).padStart(2, '0');
      const d = daySel.value;
      return d === '' ? `${y}-${mm}` : `${y}-${mm}-${String(d).padStart(2, '0')}`;
    }
  };
}
