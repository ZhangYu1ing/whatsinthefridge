// drawer.js — the slide-out storage-zone menu.
const drawer = document.getElementById('drawer');
const backdrop = document.getElementById('drawer-backdrop');
const openMenuBtn = document.getElementById('open-menu');
const closeMenuBtn = document.getElementById('close-menu');

function openDrawer() {
  drawer.classList.remove('-translate-x-full');
  backdrop.classList.remove('opacity-0', 'pointer-events-none');
}

function closeDrawer() {
  drawer.classList.add('-translate-x-full');
  backdrop.classList.add('opacity-0', 'pointer-events-none');
}

openMenuBtn.addEventListener('click', openDrawer);
closeMenuBtn.addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
