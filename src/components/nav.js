import { signOutUser } from '../auth.js';
import { escapeHtml } from '../utils/helpers.js';

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
      <button class="theme-toggle" id="themeBtn" title="Toggle dark mode" aria-label="Toggle dark mode">
        <span class="theme-track">
          <span class="theme-thumb">
            <svg class="theme-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg class="theme-icon moon-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </span>
        </span>
      </button>
      <div class="avatar-wrapper" id="avatarWrapper">
        <div class="user-avatar ${profile?.photoURL ? 'has-photo' : ''}" id="userAvatar">${profile?.photoURL ? `<img src="${escapeHtml(profile.photoURL)}" alt="avatar">` : initials}</div>
        <div class="avatar-dropdown" id="avatarDropdown">
          <div class="avatar-dropdown-header">
            <div class="avatar-dropdown-initials ${profile?.photoURL ? 'has-photo' : ''}">${profile?.photoURL ? `<img src="${escapeHtml(profile.photoURL)}" alt="avatar">` : initials}</div>
            <div class="avatar-dropdown-info">
              <div class="avatar-dropdown-name">${profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User' : 'User'}</div>
              <div class="avatar-dropdown-email">${profile?.email || ''}</div>
            </div>
          </div>
          <div class="avatar-dropdown-divider"></div>
          <a href="/account.html" class="avatar-dropdown-item ${activePage === 'account' ? 'avatar-dropdown-item--active' : ''}">&#x2699;&#xFE0F; Account Settings</a>
          ${profile?.uid ? `<a href="/profile.html?uid=${profile.uid}" class="avatar-dropdown-item ${activePage === 'profile' ? 'avatar-dropdown-item--active' : ''}">&#x1F9D1;&#x200D;&#x1F373; My Chef Profile</a>` : ''}
          <div class="avatar-dropdown-divider"></div>
          <div class="avatar-dropdown-section-label">Pages</div>
          ${NAV_LINKS.map(l => `<a href="${l.href}" class="avatar-dropdown-item ${activePage === l.page ? 'avatar-dropdown-item--active' : ''}">${l.icon} ${l.label}</a>`).join('')}
          <div class="avatar-dropdown-divider"></div>
          <button class="avatar-dropdown-item avatar-dropdown-signout" id="logoutBtn">&#x1F6AA; Sign Out</button>
        </div>
      </div>
    </div>
  `;

  // Dark mode toggle
  document.getElementById('themeBtn').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark-mode');
    const dark = document.documentElement.classList.contains('dark-mode');
    localStorage.setItem('tender_theme', dark ? 'dark' : 'light');
  });

  // Avatar dropdown toggle
  const avatarDropdown = document.getElementById('avatarDropdown');
  document.getElementById('userAvatar').addEventListener('click', (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => avatarDropdown.classList.remove('open'));
  avatarDropdown.addEventListener('click', (e) => e.stopPropagation());

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
  const t  = localStorage.getItem('tender_theme');
  const tn = localStorage.getItem('tender_theme_name') || 'default';
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark-mode');
  }
  if (tn !== 'default') document.documentElement.classList.add(`theme-${tn}`);
  if (tn === 'code' || tn === 'synthwave') document.documentElement.classList.add('dark-mode');
})();

// Glassmorphism nav — adds .scrolled class once page scrolls past 10px
(function initNavScroll() {
  function update() {
    const nav = document.getElementById('app-nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', update, { passive: true });
})();
