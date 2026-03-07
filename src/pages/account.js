import { requireAuth } from '../auth.js';
import { getUserProfile, updateUserProfile } from '../api/users.js';
import { renderNav } from '../components/nav.js';
import { escapeHtml, capitalizeFirst } from '../utils/helpers.js';

let uid = null;
let profile = null;

const DIETARY_OPTIONS = ['vegetarian','vegan','gluten-free','dairy-free','keto','halal','kosher'];
const CUISINE_OPTIONS  = ['italian','mexican','chinese','japanese','indian','thai','mediterranean','american','french','korean','greek','vietnamese'];
const CUISINE_EMOJI    = { italian:'🍝',mexican:'🌮',chinese:'🥡',japanese:'🍱',indian:'🍛',thai:'🍜',mediterranean:'🥙',american:'🍔',french:'🥐',korean:'🍲',greek:'🥗',vietnamese:'🍲' };

async function init() {
  const user = await requireAuth();
  uid = user.uid;
  renderNav('account');

  try { profile = await getUserProfile(uid); } catch (err) { console.error(err); }

  if (!profile) {
    profile = { uid };
  }

  profile.email = user.email || profile.email || '';
  if (!profile.createdAt && user.metadata?.creationTime) {
    profile.createdAt = new Date(user.metadata.creationTime);
  }

  renderNav('account', profile);
  renderAccount(profile);
}

function renderAccount(p) {
  const initials = `${(p.firstName || '?')[0]}${(p.lastName || '')[0] || ''}`.toUpperCase();
  const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User';

  const avatarEl = document.getElementById('accountAvatar');
  if (p.photoURL) {
    avatarEl.innerHTML = `<img src="${p.photoURL}" alt="Profile photo">`;
    avatarEl.classList.add('has-photo');
  } else {
    avatarEl.textContent = initials;
    avatarEl.classList.remove('has-photo');
  }
  document.getElementById('accountName').textContent = fullName;
  document.getElementById('accountEmail').textContent = p.email || '';

  renderPersonalCard(p);
  renderPreferencesCard(p);
}

// ── Personal Info card ──────────────────────────────────────────

function renderPersonalCard(p, editing = false) {
  const card = document.getElementById('personalCard');
  if (editing) {
    card.innerHTML = `
      <div class="card-header">
        <h2>Personal Info</h2>
        <div class="card-actions">
          <button class="edit-save-btn" id="savePersonalBtn">Save</button>
          <button class="edit-cancel-btn" id="cancelPersonalBtn">Cancel</button>
        </div>
      </div>
      <div class="edit-form">
        <div class="edit-field">
          <label>First Name</label>
          <input type="text" id="editFirstName" value="${escapeHtml(p.firstName || '')}" placeholder="First name">
        </div>
        <div class="edit-field">
          <label>Last Name</label>
          <input type="text" id="editLastName" value="${escapeHtml(p.lastName || '')}" placeholder="Last name">
        </div>
        <div class="edit-field">
          <label>Email</label>
          <input type="email" value="${escapeHtml(p.email || '')}" disabled class="input-disabled" title="Email cannot be changed here">
          <span class="field-note">Email cannot be changed</span>
        </div>
      </div>
    `;
    document.getElementById('savePersonalBtn').addEventListener('click', savePersonal);
    document.getElementById('cancelPersonalBtn').addEventListener('click', () => renderPersonalCard(p));
  } else {
    let memberSince = '-';
    if (p.createdAt) {
      let d = p.createdAt;
      if (d.toDate) d = d.toDate();
      else if (!(d instanceof Date)) d = new Date(d);
      if (!isNaN(d)) memberSince = d.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
    }
    const rows = [
      { label:'First Name', value: p.firstName || '-' },
      { label:'Last Name',  value: p.lastName  || '-' },
      { label:'Email',      value: p.email     || '-' },
      { label:'Member Since', value: memberSince },
    ];
    card.innerHTML = `
      <div class="card-header">
        <h2>Personal Info</h2>
        <button class="edit-btn" id="editPersonalBtn">Edit</button>
      </div>
      ${rows.map(r => `
        <div class="account-row">
          <div class="account-row-label">${r.label}</div>
          <div class="account-row-value">${escapeHtml(String(r.value))}</div>
        </div>`).join('')}
    `;
    document.getElementById('editPersonalBtn').addEventListener('click', () => renderPersonalCard(p, true));
  }
}

async function savePersonal() {
  const firstName = document.getElementById('editFirstName').value.trim();
  const lastName  = document.getElementById('editLastName').value.trim();
  const btn = document.getElementById('savePersonalBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    await updateUserProfile(uid, { firstName, lastName });
    profile.firstName = firstName;
    profile.lastName  = lastName;
    // Update header
    document.getElementById('accountName').textContent = `${firstName} ${lastName}`.trim() || 'User';
    renderNav('account', profile);
    renderPersonalCard(profile);
  } catch (err) {
    alert(`Failed to save: ${err.message}`);
    btn.textContent = 'Save';
    btn.disabled = false;
  }
}

// ── Preferences card ────────────────────────────────────────────

function renderPreferencesCard(p, editing = false) {
  const card = document.getElementById('preferencesCard');
  if (editing) {
    const dietary = p.dietary || [];
    const cuisines = p.cuisines || [];
    card.innerHTML = `
      <div class="card-header">
        <h2>Preferences</h2>
        <div class="card-actions">
          <button class="edit-save-btn" id="savePrefBtn">Save</button>
          <button class="edit-cancel-btn" id="cancelPrefBtn">Cancel</button>
        </div>
      </div>
      <div class="edit-form">
        <div class="edit-field">
          <label>Cooking Skill</label>
          <select id="editCookingSkill">
            ${['beginner','intermediate','advanced','chef'].map(v =>
              `<option value="${v}" ${p.cookingSkill === v ? 'selected' : ''}>${capitalizeFirst(v)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="edit-field">
          <label>Household Size</label>
          <select id="editHouseholdSize">
            ${['1','2','3-4','5+'].map(v =>
              `<option value="${v}" ${p.householdSize === v ? 'selected' : ''}>${v === '1' ? 'Just me' : v + ' people'}</option>`
            ).join('')}
          </select>
        </div>
        <div class="edit-field">
          <label>Meals / Week</label>
          <select id="editMealsPerWeek">
            ${['1-3','4-7','8-14','15+'].map(v =>
              `<option value="${v}" ${p.mealsPerWeek === v ? 'selected' : ''}>${v} meals</option>`
            ).join('')}
          </select>
        </div>
        <div class="edit-field">
          <label>Weekly Budget</label>
          <select id="editWeeklyBudget">
            <option value="budget"   ${p.weeklyBudget === 'budget'   ? 'selected' : ''}>Budget-friendly (Under $50)</option>
            <option value="moderate" ${p.weeklyBudget === 'moderate' ? 'selected' : ''}>Moderate ($50-$100)</option>
            <option value="flexible" ${p.weeklyBudget === 'flexible' ? 'selected' : ''}>Flexible ($100-$150)</option>
            <option value="premium"  ${p.weeklyBudget === 'premium'  ? 'selected' : ''}>Premium ($150+)</option>
          </select>
        </div>
        <div class="edit-field">
          <label>Dietary Restrictions</label>
          <div class="check-grid">
            ${DIETARY_OPTIONS.map(v => `
              <label class="check-option">
                <input type="checkbox" name="dietary" value="${v}" ${dietary.includes(v) ? 'checked' : ''}>
                ${capitalizeFirst(v)}
              </label>`).join('')}
          </div>
        </div>
        <div class="edit-field">
          <label>Favourite Cuisines</label>
          <div class="check-grid">
            ${CUISINE_OPTIONS.map(v => `
              <label class="check-option">
                <input type="checkbox" name="cuisine" value="${v}" ${cuisines.includes(v) ? 'checked' : ''}>
                ${CUISINE_EMOJI[v] || ''} ${capitalizeFirst(v)}
              </label>`).join('')}
          </div>
        </div>
      </div>
    `;
    document.getElementById('savePrefBtn').addEventListener('click', savePreferences);
    document.getElementById('cancelPrefBtn').addEventListener('click', () => renderPreferencesCard(p));
  } else {
    const rows = [
      { label:'Cooking Skill',  value: capitalizeFirst(p.cookingSkill || '-') },
      { label:'Household Size', value: p.householdSize ?? '-' },
      { label:'Meals / Week',   value: p.mealsPerWeek  ?? '-' },
      { label:'Weekly Budget',  value: p.weeklyBudget  || '-' },
      { label:'Dietary',        value: (p.dietary  || []).join(', ') || 'None' },
      { label:'Cuisines',       value: (p.cuisines || []).map(capitalizeFirst).join(', ') || 'Any' },
    ];
    card.innerHTML = `
      <div class="card-header">
        <h2>Preferences</h2>
        <button class="edit-btn" id="editPrefBtn">Edit</button>
      </div>
      ${rows.map(r => `
        <div class="account-row">
          <div class="account-row-label">${r.label}</div>
          <div class="account-row-value">${escapeHtml(String(r.value))}</div>
        </div>`).join('')}
    `;
    document.getElementById('editPrefBtn').addEventListener('click', () => renderPreferencesCard(p, true));
  }
}

async function savePreferences() {
  const data = {
    cookingSkill:  document.getElementById('editCookingSkill').value,
    householdSize: document.getElementById('editHouseholdSize').value,
    mealsPerWeek:  document.getElementById('editMealsPerWeek').value,
    weeklyBudget:  document.getElementById('editWeeklyBudget').value,
    dietary:  [...document.querySelectorAll('input[name="dietary"]:checked')].map(el => el.value),
    cuisines: [...document.querySelectorAll('input[name="cuisine"]:checked')].map(el => el.value),
  };
  const btn = document.getElementById('savePrefBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    await updateUserProfile(uid, data);
    Object.assign(profile, data);
    renderPreferencesCard(profile);
  } catch (err) {
    alert(`Failed to save: ${err.message}`);
    btn.textContent = 'Save';
    btn.disabled = false;
  }
}

// ── Photo upload ────────────────────────────────────────────────

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 256;
        let { width, height } = img;
        if (width > height) { if (width  > MAX) { height = Math.round(height * MAX / width);  width  = MAX; } }
        else                 { if (height > MAX) { width  = Math.round(width  * MAX / height); height = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!uid) { alert('Still loading — please try again.'); return; }

  const label = document.getElementById('avatarUploadBtn');
  label.textContent = 'Saving...';
  label.style.pointerEvents = 'none';
  try {
    const dataURL = await compressImage(file);
    await updateUserProfile(uid, { photoURL: dataURL });
    if (profile) profile.photoURL = dataURL;
    const avatarEl = document.getElementById('accountAvatar');
    avatarEl.innerHTML = `<img src="${dataURL}" alt="Profile photo">`;
    avatarEl.classList.add('has-photo');
    if (profile) renderNav('account', profile);
    label.textContent = 'Change Photo';
  } catch (err) {
    console.error(err);
    alert(`Failed to save photo: ${err.message}`);
    label.textContent = 'Change Photo';
  } finally {
    label.style.pointerEvents = '';
    e.target.value = '';
  }
});

init().catch(console.error);
