// expiry-alert.js — the "Expiring Soon" section on the home page, with its scroll-in animation.

// Set once the Expiring Soon card has scrolled into view; groups rendered afterwards appear immediately.
let expiryRevealed = false;

// Icon and color per zone, in display order (names come from Items.ZONE_NAMES).
const ZONE_META = {
  chilled: { icon: 'thermometer-snowflake', cls: 'text-sky-400' },
  pantry: { icon: 'package', cls: 'text-amber-400' },
  freezer: { icon: 'snowflake', cls: 'text-indigo-400' },
  outside: { icon: 'archive', cls: 'text-amber-500' }
};

// Update the home-page Expiring Soon window (expired items and those due within Items.SOON_DAYS).
function updateExpiryAlert() {
  let expired = 0;
  let soon = 0;
  const byZone = {};
  inventoryData.forEach(item => {
    const days = Items.daysUntilExpiry(item.expiry);
    if (days === null || days > Items.SOON_DAYS) return;
    (byZone[item.zone] ??= []).push(item);
    if (days < 0) expired++;
    else soon++;
  });

  const parts = [];
  if (expired) parts.push(`${expired} expired`);
  if (soon) parts.push(`${soon} expiring soon`);
  document.getElementById('expiry-panel').classList.toggle('hidden', parts.length === 0);
  document.getElementById('expiry-summary').textContent = parts.join(' · ');

  document.getElementById('expiry-groups').innerHTML = Object.keys(ZONE_META)
    .filter(zone => byZone[zone])
    .map((zone, i) => {
      const meta = ZONE_META[zone];
      const rows = Items.sortByExpiry(byZone[zone]).map(item => {
        const s = expiryStatus(item.expiry);
        return `
          <li class="flex items-center justify-between gap-3 text-base">
            <div class="flex items-center gap-3 min-w-0">
              <img src="${escapeHtml(item.img)}" alt="" class="w-10 h-10 rounded-xl object-cover shrink-0">
              <span class="text-zinc-100 truncate">${escapeHtml(item.name)}</span>
              <span class="text-sm text-zinc-500">x${escapeHtml(item.qty ?? 1)}</span>
            </div>
            <span class="${s.cls} text-sm font-semibold whitespace-nowrap">${escapeHtml(s.label)}</span>
          </li>`;
      }).join('');
      return `
        <div class="${expiryRevealed ? '' : 'opacity-0 translate-y-6'} transition-all duration-500 ease-out" style="transition-delay: ${200 + i * 150}ms">
          <div class="flex items-center space-x-2 mb-3">
            <i data-lucide="${meta.icon}" class="w-5 h-5 ${meta.cls}"></i>
            <h3 class="text-base font-bold text-white">${Items.ZONE_NAMES[zone]}</h3>
          </div>
          <ul class="space-y-2.5">${rows}</ul>
        </div>`;
    }).join('');
  lucide.createIcons();
}

// Fade and slide the Expiring Soon card in the first time it scrolls into view,
// then bring in each zone group one after another (delays are set in updateExpiryAlert).
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.remove('opacity-0', 'translate-y-8');
    expiryRevealed = true;
    document.querySelectorAll('#expiry-groups > div').forEach(group => {
      group.classList.remove('opacity-0', 'translate-y-6');
    });
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.15 });
revealObserver.observe(document.getElementById('expiry-card'));
