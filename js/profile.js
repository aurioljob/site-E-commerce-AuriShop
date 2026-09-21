// js/profile.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';
import { uploadFile, deleteFile, validateImage, extractPathFromUrl } from './storage.js';

let state = {
  user: null,
  profile: null,
  addresses: []
};

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }
  state.user = user;

  await Promise.all([loadProfile(), loadAddresses()]);
  render();
});

/* ============================================================
   CHARGEMENT
   ============================================================ */
async function loadProfile() {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', state.user.id)
    .maybeSingle();

  state.profile = data || {
    id: state.user.id,
    first_name: '',
    last_name: '',
    phone: '',
    avatar_url: null
  };
}

async function loadAddresses() {
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', state.user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  state.addresses = data || [];
}

/* ============================================================
   RENDU PRINCIPAL
   ============================================================ */
function render() {
  const container = document.getElementById('profile-container');
  const p = state.profile;

  const initials = `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}`.toUpperCase() || '?';

  const avatarHtml = p.avatar_url
    ? `<img src="${p.avatar_url}" alt="Avatar" id="avatar-img">`
    : `<div class="avatar-placeholder" id="avatar-img">${initials}</div>`;

  container.innerHTML = `
    <div class="profile-layout">
      
      <!-- Colonne gauche : avatar + navigation -->
      <aside class="profile-sidebar">
        <div class="profile-avatar-block">
          <div class="profile-avatar" id="avatar-wrapper">
            ${avatarHtml}
            <button class="avatar-edit-btn" id="edit-avatar" title="Changer la photo">
              📷
            </button>
            <input type="file" id="avatar-input" accept="image/*" style="display:none;">
          </div>
          <h3>${p.first_name || ''} ${p.last_name || ''}</h3>
          <p style="color:var(--gris-texte);font-size:0.85rem;">${state.user.email}</p>
        </div>

        <nav class="profile-nav">
          <a href="#info" class="profile-nav-item active" data-tab="info">
            👤 Informations
          </a>
          <a href="#addresses" class="profile-nav-item" data-tab="addresses">
            📍 Mes adresses
          </a>
          <a href="orders.html" class="profile-nav-item">
            📦 Mes commandes
          </a>
          <a href="wishlist.html" class="profile-nav-item">
            ❤️ Mes favoris
          </a>
        </nav>
      </aside>

      <!-- Colonne droite : contenu -->
      <main class="profile-content">
        
        <!-- Onglet Informations -->
        <div class="profile-tab active" id="tab-info">
          <div class="profile-block">
            <div class="profile-block-header">
              <h3>Informations personnelles</h3>
            </div>

            <form id="profile-form" class="profile-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Prénom</label>
                  <input type="text" id="p-first-name" value="${p.first_name || ''}">
                </div>
                <div class="form-group">
                  <label>Nom</label>
                  <input type="text" id="p-last-name" value="${p.last_name || ''}">
                </div>
              </div>

              <div class="form-group">
                <label>Email</label>
                <input type="email" value="${state.user.email}" disabled 
                       style="background:var(--gris-clair);cursor:not-allowed;">
                <small style="color:var(--gris-texte);font-size:0.8rem;display:block;margin-top:0.35rem;">
                  L'email ne peut pas être modifié ici.
                </small>
              </div>

              <div class="form-group">
                <label>Téléphone</label>
                <input type="tel" id="p-phone" value="${p.phone || ''}" placeholder="+237 6XX XXX XXX">
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>

          <div class="profile-block">
            <div class="profile-block-header">
              <h3>Sécurité</h3>
            </div>
            <p style="color:var(--gris-texte);font-size:0.9rem;margin-bottom:1rem;">
              Modifiez votre mot de passe régulièrement pour la sécurité de votre compte.
            </p>
            <button class="btn btn-outline" id="change-password-btn">
              🔒 Changer mon mot de passe
            </button>
          </div>
        </div>

        <!-- Onglet Adresses -->
        <div class="profile-tab" id="tab-addresses">
          <div class="profile-block">
            <div class="profile-block-header">
              <h3>Mes adresses de livraison</h3>
              <button class="btn btn-primary" id="add-address-btn" style="font-size:0.85rem;">
                + Ajouter une adresse
              </button>
            </div>

            <div id="addresses-list">
              ${renderAddresses()}
            </div>
          </div>
        </div>

      </main>
    </div>
  `;

  bindEvents();
}

/* ============================================================
   RENDU DES ADRESSES
   ============================================================ */
function renderAddresses() {
  if (state.addresses.length === 0) {
    return `
      <div style="text-align:center;padding:2rem;color:var(--gris-texte);font-size:0.9rem;">
        Aucune adresse enregistrée pour le moment.
      </div>
    `;
  }

  return `
    <div class="addresses-grid">
      ${state.addresses.map(a => `
        <div class="address-card">
          <div class="address-card-header">
            <strong>${a.label || 'Adresse'}</strong>
            ${a.is_default ? '<span class="badge badge-active" style="font-size:0.7rem;">Par défaut</span>' : ''}
          </div>
          <div class="address-card-body">
            <div><strong>${a.full_name}</strong></div>
            ${a.phone ? `<div>📞 ${a.phone}</div>` : ''}
            <div>${a.street}</div>
            <div>${a.city}${a.region ? `, ${a.region}` : ''}</div>
            <div>${a.country}</div>
          </div>
          <div class="address-card-actions">
            <button class="icon-btn" data-action="edit-address" data-id="${a.id}" title="Modifier">✏️</button>
            ${!a.is_default ? `<button class="icon-btn" data-action="set-default" data-id="${a.id}" title="Définir par défaut">⭐</button>` : ''}
            <button class="icon-btn danger" data-action="delete-address" data-id="${a.id}" title="Supprimer">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ============================================================
   BIND DES ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  // Upload avatar
  const avatarBtn = document.getElementById('edit-avatar');
  const avatarInput = document.getElementById('avatar-input');
  avatarBtn?.addEventListener('click', () => avatarInput.click());
  avatarInput?.addEventListener('change', handleAvatarUpload);

  // Formulaire profil
  document.getElementById('profile-form')?.addEventListener('submit', handleProfileSave);

  // Changement de mot de passe
  document.getElementById('change-password-btn')?.addEventListener('click', openPasswordModal);

  // Navigation par onglets
  document.querySelectorAll('.profile-nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      document.querySelectorAll('.profile-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
  });

  // Ajouter une adresse
  document.getElementById('add-address-btn')?.addEventListener('click', () => openAddressModal());

  // Actions sur les adresses
  document.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === 'edit-address') openAddressModal(id);
      else if (action === 'set-default') setDefaultAddress(id);
      else if (action === 'delete-address') deleteAddress(id);
    });
  });
}

/* ============================================================
   UPLOAD AVATAR
   ============================================================ */
async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const check = validateImage(file, 3); // 3 MB max pour les avatars
  if (!check.valid) {
    alert(check.error);
    e.target.value = '';
    return;
  }

  // Afficher un état de chargement
  const wrapper = document.getElementById('avatar-wrapper');
  const previousHtml = wrapper.innerHTML;
  wrapper.innerHTML = `
    <div class="avatar-placeholder" style="background:var(--orange);color:#fff;">
      <span style="font-size:0.75rem;">Envoi...</span>
    </div>
  `;

  try {
    // 1. Supprimer l'ancienne image (si elle existe)
    if (state.profile.avatar_url) {
      const oldPath = extractPathFromUrl(state.profile.avatar_url);
      if (oldPath) {
        try { await deleteFile('avatars', oldPath); } catch (e) { /* ignore */ }
      }
    }

    // 2. Upload dans le dossier personnel : {user_id}/avatar-{timestamp}.ext
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `${state.user.id}/avatar-${Date.now()}.${ext}`;
    const { url } = await uploadFile('avatars', file, path);

    // 3. Mettre à jour profiles
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', state.user.id);

    if (error) throw error;

    // 4. Mettre à jour l'UI
    state.profile.avatar_url = url;
    wrapper.innerHTML = `
      <img src="${url}" alt="Avatar" id="avatar-img">
      <button class="avatar-edit-btn" id="edit-avatar" title="Changer la photo">📷</button>
      <input type="file" id="avatar-input" accept="image/*" style="display:none;">
    `;
    // Rebinder
    document.getElementById('edit-avatar')?.addEventListener('click', () => 
      document.getElementById('avatar-input').click()
    );
    document.getElementById('avatar-input')?.addEventListener('change', handleAvatarUpload);

    // Toast
    showToast('Avatar mis à jour ✅', 'success');

  } catch (err) {
    console.error('Erreur avatar:', err);
    alert('Erreur upload avatar : ' + err.message);
    wrapper.innerHTML = previousHtml;
  }

  e.target.value = '';
}

/* ============================================================
   SAUVEGARDE DU PROFIL
   ============================================================ */
async function handleProfileSave(e) {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  const payload = {
    first_name: document.getElementById('p-first-name').value.trim() || null,
    last_name: document.getElementById('p-last-name').value.trim() || null,
    phone: document.getElementById('p-phone').value.trim() || null
  };

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', state.user.id);

  if (error) {
    alert('Erreur : ' + error.message);
    btn.disabled = false;
    btn.textContent = 'Enregistrer les modifications';
    return;
  }

  state.profile = { ...state.profile, ...payload };
  showToast('Profil mis à jour ✅', 'success');

  // Rafraîchir la navbar (le prénom a peut-être changé)
  initNavbar();

  btn.disabled = false;
  btn.textContent = 'Enregistrer les modifications';
}

/* ============================================================
   CHANGER LE MOT DE PASSE
   ============================================================ */
function openPasswordModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'password-modal';
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>Changer le mot de passe</h3>
        <button class="modal-close" id="pwd-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nouveau mot de passe</label>
          <input type="password" id="new-password" minlength="6" placeholder="Au moins 6 caractères">
        </div>
        <div class="form-group">
          <label>Confirmer le mot de passe</label>
          <input type="password" id="confirm-password" minlength="6">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="pwd-cancel">Annuler</button>
        <button class="btn btn-primary" id="pwd-save">Changer le mot de passe</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', close);
  document.getElementById('pwd-close').addEventListener('click', close);
  document.getElementById('pwd-cancel').addEventListener('click', close);

  document.getElementById('pwd-save').addEventListener('click', async () => {
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;

    if (newPwd.length < 6) { alert('Au moins 6 caractères.'); return; }
    if (newPwd !== confirmPwd) { alert('Les mots de passe ne correspondent pas.'); return; }

    const btn = document.getElementById('pwd-save');
    btn.disabled = true;
    btn.textContent = 'Changement...';

    const { error } = await supabase.auth.updateUser({ password: newPwd });

    if (error) {
      alert('Erreur : ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Changer le mot de passe';
      return;
    }

    close();
    showToast('Mot de passe modifié ✅', 'success');
  });
}

/* ============================================================
   AJOUTER / MODIFIER UNE ADRESSE
   ============================================================ */
function openAddressModal(id = null) {
  const isEdit = id !== null;
  const a = isEdit ? state.addresses.find(x => x.id === id) : null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'address-modal';
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>${isEdit ? 'Modifier l\'adresse' : 'Nouvelle adresse'}</h3>
        <button class="modal-close" id="addr-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" id="addr-fullname" value="${a?.full_name || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Téléphone</label>
            <input type="tel" id="addr-phone" value="${a?.phone || ''}">
          </div>
          <div class="form-group">
            <label>Libellé (ex: Maison)</label>
            <input type="text" id="addr-label" value="${a?.label || ''}">
          </div>
        </div>
        <div class="form-group">
          <label>Rue / Adresse *</label>
          <input type="text" id="addr-street" value="${a?.street || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Ville *</label>
            <input type="text" id="addr-city" value="${a?.city || ''}" required>
          </div>
          <div class="form-group">
            <label>Région</label>
            <input type="text" id="addr-region" value="${a?.region || ''}">
          </div>
        </div>
        <div class="form-group">
          <label>Pays *</label>
          <input type="text" id="addr-country" value="${a?.country || 'Cameroun'}" required>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <input type="checkbox" id="addr-default" ${a?.is_default ? 'checked' : ''}>
            Définir comme adresse par défaut
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="addr-cancel">Annuler</button>
        <button class="btn btn-primary" id="addr-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', close);
  document.getElementById('addr-close').addEventListener('click', close);
  document.getElementById('addr-cancel').addEventListener('click', close);

  document.getElementById('addr-save').addEventListener('click', async () => {
    const payload = {
      user_id: state.user.id,
      full_name: document.getElementById('addr-fullname').value.trim(),
      phone: document.getElementById('addr-phone').value.trim() || null,
      label: document.getElementById('addr-label').value.trim() || null,
      street: document.getElementById('addr-street').value.trim(),
      city: document.getElementById('addr-city').value.trim(),
      region: document.getElementById('addr-region').value.trim() || null,
      country: document.getElementById('addr-country').value.trim(),
      is_default: document.getElementById('addr-default').checked
    };

    if (!payload.full_name || !payload.street || !payload.city || !payload.country) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // Si 1ère adresse → par défaut
    if (state.addresses.length === 0) payload.is_default = true;

    // Si on met par défaut, retirer des autres
    if (payload.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', state.user.id)
        .neq('id', id || 0);
    }

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('addresses').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('addresses').insert(payload));
    }

    if (error) {
      alert('Erreur : ' + error.message);
      return;
    }

    await loadAddresses();
    close();
    render();
    showToast(isEdit ? 'Adresse mise à jour ✅' : 'Adresse ajoutée ✅', 'success');
  });
}

/* ============================================================
   DÉFINIR COMME DÉFAUT
   ============================================================ */
async function setDefaultAddress(id) {
  // Retirer le défaut de toutes
  await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', state.user.id);

  // Définir celle-ci
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id);

  if (error) { alert('Erreur : ' + error.message); return; }

  await loadAddresses();
  render();
  showToast('Adresse par défaut mise à jour ✅', 'success');
}

/* ============================================================
   SUPPRIMER UNE ADRESSE
   ============================================================ */
async function deleteAddress(id) {
  if (!confirm('Supprimer cette adresse ?')) return;

  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) { alert('Erreur : ' + error.message); return; }

  await loadAddresses();
  render();
  showToast('Adresse supprimée', 'success');
}

/* ============================================================
   TOAST (notification éphémère)
   ============================================================ */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}