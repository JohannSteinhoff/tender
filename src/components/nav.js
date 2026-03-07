import { signOutUser } from '../auth.js';

const NAV_LINKS = [
  { page: 'dashboard', href: '/dashboard.html', icon: '&#x1F3E0;', label: 'Home' },
  { page: 'swipe',     href: '/swipe.html',     icon: '&#x1F525;', label: 'Swipe' },
  { page: 'discover',  href: '/discover.html',  icon: '&#x1F50D;', label: 'Discover' },
  { page: 'mealplan',  href: '/mealplan.html',  icon: '&#x1F4C5;', label: 'Meal Plan' },
  { page: 'grocery',   href: '/grocery.html',   icon: '&#x1F6D2;', label: 'Grocery' },
];

/**
 * Renders the top nav bar into <nav id="app-nav"> and injects the mobile bottom nav.
 * @param {string} activePage - 'dashboard' | 'swipe' | 'discover' | 'mealplan' | 'grocery'
 * @param {object} profile - user profile (optional)
 */
export function renderNav(activePage, profile = null) {
  const nav = document.getElementById('app-nav');
  if (!nav) return;

  const initials = profile
    ? `${(profile.firstName || '?')[0]}${(profile.lastName || '')[0] || ''}`.toUpperCase()
    : '?';

  const menuLinks = NAV_LINKS.map(l => `
    <a href="${l.href}" class="${activePage === l.page ? 'active' : ''}">
      ${l.icon} <span class="label">${l.label}</span>
    </a>`).join('');

  nav.innerHTML = `
    <a href="/dashboard.html" class="logo">&#x1F373; Tender</a>
    <div class="nav-menu">${menuLinks}</div>
    <div class="nav-right">
      <button class="theme-btn" id="themeBtn" title="Toggle dark mode">&#x1F31B;</button>
      <div class="user-avatar" title="${profile ? profile.firstName + ' ' + (profile.lastName || '') : ''}">${initials}</div>
      <button class="logout-btn" id="logoutBtn">Sign Out</button>
    </div>
  `;

  // Dark mode toggle
  document.getElementById('themeBtn').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark-mode');
    const dark = document.documentElement.classList.contains('dark-mode');
    localStorage.setItem('tender_theme', dark ? 'dark' : 'light');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', signOutUser);

  // Mobile bottom nav
  const existing = document.getElementById('mobile-nav');
  if (existing) existing.remove();

  const mobileNav = document.createElement('nav');
  mobileNav.id = 'mobile-nav';
  mobileNav.className = 'mobile-nav';
  mobileNav.innerHTML = NAV_LINKS.map(l => `
    <a href="${l.href}" class="${activePage === l.page ? 'active' : ''}">
      <span class="mob-icon">${l.icon}</span>
      <span>${l.label}</span>
    </a>`).join('');
  document.body.appendChild(mobileNav);
}

// Apply saved theme immediately (before render, to avoid flash)
(function applyTheme() {
  const t = localStorage.getItem('tender_theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark-mode');
  }
})();
