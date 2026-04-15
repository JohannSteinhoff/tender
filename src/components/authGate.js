/**
 * Shows a centered modal prompting the guest to sign in or create an account.
 * @param {string} action - short description, e.g. "like recipes" or "post comments"
 */
export function showAuthGate(action = 'use this feature') {
  const existing = document.getElementById('auth-gate-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'auth-gate-overlay';
  overlay.id = 'auth-gate-overlay';
  overlay.innerHTML = `
    <div class="auth-gate-dialog" role="dialog" aria-modal="true">
      <button class="auth-gate-close" id="authGateClose" aria-label="Close">&#x2715;</button>
      <div class="auth-gate-icon">&#x1F512;</div>
      <h3>Sign in to ${action}</h3>
      <p>Create a free account or sign in to unlock this and all other features.</p>
      <div class="auth-gate-actions">
        <a href="/login.html" class="auth-gate-btn auth-gate-btn-primary">Sign In</a>
        <a href="/signup.html" class="auth-gate-btn auth-gate-btn-secondary">Create Account</a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function close() {
    overlay.classList.add('auth-gate-hiding');
    setTimeout(() => overlay.remove(), 180);
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) { if (e.key === 'Escape') close(); }

  document.getElementById('authGateClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', escHandler);
}
