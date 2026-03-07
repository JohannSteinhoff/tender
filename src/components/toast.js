let toastEl = null;
let hideTimer = null;

function getEl() {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  return toastEl;
}

/**
 * Show a toast message.
 * @param {string} message
 * @param {'default'|'success'|'error'} type
 * @param {number} duration ms
 */
export function showToast(message, type = 'default', duration = 3000) {
  const el = getEl();
  el.textContent = message;
  el.className = `toast${type !== 'default' ? ' ' + type : ''}`;

  // Force reflow for animation re-trigger
  void el.offsetWidth;
  el.classList.add('show');

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}
