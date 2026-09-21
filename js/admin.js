// js/admin.js
import { supabase } from './supabase.js';

/* ============================================================
   PROTECTION DE LA PAGE : redirige si non-admin
   ============================================================ */
export async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    window.location.href = '../login.html';
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    alert('Accès refusé. Vous n\'êtes pas administrateur.');
    window.location.href = '../index.html';
    return null;
  }

  return { user, profile };
}

export function renderAdminSidebar(profile, activePage) {
  const sidebar = document.getElementById('admin-sidebar');
  if (!sidebar) return;

  const links = [
    { href: 'index.html',      icon: 'layout-dashboard', label: 'Dashboard' },
    { href: 'products.html',   icon: 'package',          label: 'Produits' },
    { href: 'categories.html', icon: 'tags',             label: 'Catégories' },
    { href: 'orders.html',     icon: 'shopping-cart',    label: 'Commandes' },
    { href: 'users.html',      icon: 'users',            label: 'Utilisateurs' },
    { href: 'reviews.html',    icon: 'star',             label: 'Avis' },
    { href: 'statistics.html', icon: 'bar-chart-3',      label: 'Statistiques' }
  ];

  sidebar.innerHTML = `
    <div class="admin-sidebar-logo">
      <img src="../assets/logo.png" alt="AuriShop">
      <span>Admin</span>
    </div>
    <nav>
      <ul class="admin-nav">
        ${links.map(l => `
          <li>
            <a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">
              <i data-lucide="${l.icon}" class="admin-nav-icon"></i>
              ${l.label}
            </a>
          </li>
        `).join('')}
      </ul>
    </nav>
    <div class="admin-sidebar-footer">
      <a href="../index.html" style="color:inherit;display:inline-flex;align-items:center;gap:0.5rem;">
        <i data-lucide="arrow-left" style="width:16px;height:16px;"></i>
        Retour au site
      </a>
    </div>
  `;

  // ✅ Générer les SVG Lucide
  if (window.lucide) window.lucide.createIcons();
}

export function renderAdminUser(profile) {
  const el = document.getElementById('admin-user');
  if (!el || !profile) return;

  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || 'A';

  el.innerHTML = `
    <div class="admin-user-avatar">${initials}</div>
    <div>
      <div style="font-weight:600;">${profile.first_name || ''} ${profile.last_name || ''}</div>
      <div style="font-size:0.78rem;color:var(--gris-texte);">Administrateur</div>
    </div>
    <button class="icon-btn" id="admin-logout" title="Déconnexion">
      <i data-lucide="log-out" style="width:16px;height:16px;"></i>
    </button>
  `;

  if (window.lucide) window.lucide.createIcons();

  document.getElementById('admin-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '../index.html';
  });
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
export function formatPrice(n) {
  return Number(n || 0).toFixed(2) + ' €';
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function statusBadge(status) {
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    processing: 'En préparation',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée'
  };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

/* ============================================================
   MODALE : création dynamique
   ============================================================ */
export function openModal({ title, bodyHtml, onConfirm, onOpen, confirmLabel = 'Enregistrer' }) {
  // Supprimer une éventuelle modale existante
  document.getElementById('global-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'global-modal';
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="modal-close-btn">×</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">Annuler</button>
        <button class="btn btn-primary" id="modal-confirm-btn">${confirmLabel}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

    if (window.lucide) window.lucide.createIcons();

  // ✅ Appeler onOpen si fourni
    if (typeof onOpen === 'function') {
        onOpen(overlay);
    }

  const close = () => overlay.remove();
  overlay.addEventListener('click', close);
  document.getElementById('modal-close-btn').addEventListener('click', close);
  document.getElementById('modal-cancel-btn').addEventListener('click', close);
  document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
    const btn = document.getElementById('modal-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Traitement...';
    const result = await onConfirm();
    if (result !== false) close();
    else {
      btn.disabled = false;
      btn.textContent = confirmLabel;
    }
  });

  return overlay;
}