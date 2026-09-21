// js/admin-users.js
import { supabase } from './supabase.js';
import {
  requireAdmin,
  renderAdminSidebar,
  renderAdminUser,
  formatDate,
  formatPrice
} from './admin.js';

let state = {
  page: 1,
  perPage: 10,
  total: 0,
  search: '',
  role: ''
};

(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  renderAdminSidebar(ctx.profile, 'users.html');
  renderAdminUser(ctx.profile);

  await loadUsers();
  bindEvents();
})();

/* ============================================================
   LISTE DES UTILISATEURS
   ============================================================ */
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Chargement...</td></tr>';

  let query = supabase
    .from('profiles_with_email')
    .select('id, first_name, last_name, phone, avatar_url, role, created_at', { count: 'exact' });

  if (state.role) {
    query = query.eq('role', state.role);
  }

  if (state.search) {
    query = query.or(`first_name.ilike.%${state.search}%,last_name.ilike.%${state.search}%`);
  }

  query = query.order('created_at', { ascending: false });

  const from = (state.page - 1) * state.perPage;
  query = query.range(from, from + state.perPage - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7" class="error">Erreur : ${error.message}</td></tr>`;
    return;
  }

  state.total = count || 0;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gris-texte);">Aucun utilisateur trouvé.</td></tr>';
    renderPagination();
    return;
  }

  // Récupérer les commandes par utilisateur pour les stats
  const userIds = data.map(u => u.id);
  const { data: orders } = await supabase
    .from('orders')
    .select('user_id, total, status')
    .in('user_id', userIds)
    .neq('status', 'cancelled');

  const ordersByUser = {};
  (orders || []).forEach(o => {
    if (!ordersByUser[o.user_id]) ordersByUser[o.user_id] = { count: 0, total: 0 };
    ordersByUser[o.user_id].count++;
    ordersByUser[o.user_id].total += Number(o.total);
  });

  tbody.innerHTML = data.map(u => {
    const initials = `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() || '?';
    const avatar = u.avatar_url
      ? `<img src="${u.avatar_url}" alt="${initials}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:var(--orange);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;">${initials}</div>`;

    const stats = ordersByUser[u.id];
    const statsHtml = stats
      ? `<div style="font-size:0.78rem;color:var(--gris-texte);">${stats.count} cmd · ${formatPrice(stats.total)}</div>`
      : `<div style="font-size:0.78rem;color:var(--gris-texte);">Aucune commande</div>`;

    return `
      <tr>
        <td>${avatar}</td>
        <td>
          <strong>${u.first_name || ''} ${u.last_name || ''}</strong>
          ${statsHtml}
        </td>
        <td style="font-size:0.85rem;">${u.email || '—'}</td>
        <td>${u.phone || '—'}</td>
        <td>
            <span class="badge badge-${u.role === 'admin' ? 'admin' : 'customer'}" style="display:inline-flex;align-items:center;gap:0.35rem;">
                <i data-lucide="${u.role === 'admin' ? 'crown' : 'user'}" style="width:12px;height:12px;"></i>
                ${u.role === 'admin' ? 'Admin' : 'Client'}
            </span>
        </td>
        <td style="font-size:0.85rem;">${formatDate(u.created_at)}</td>
        <td>
            <div class="table-actions">
                <button class="icon-btn" data-action="toggle-role" data-id="${u.id}" data-role="${u.role}" title="Changer le rôle">
                <i data-lucide="${u.role === 'admin' ? 'user' : 'crown'}" style="width:16px;height:16px;"></i>
                </button>
            </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-action="toggle-role"]').forEach(btn => {
    btn.addEventListener('click', () => toggleRole(btn.dataset.id, btn.dataset.role));
  });
  if (window.lucide) window.lucide.createIcons();

  renderPagination();
}

/* ============================================================
   CHANGER LE RÔLE
   ============================================================ */
async function toggleRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'customer' : 'admin';

  if (newRole === 'admin') {
    if (!confirm('Promouvoir cet utilisateur en administrateur ?')) return;
  } else {
    if (!confirm('Rétrograder cet administrateur en client ?')) return;
  }

  const { error } = await supabase
    .from('profiles_with_email')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  await loadUsers();
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
  const el = document.getElementById('users-pagination');
  const totalPages = Math.ceil(state.total / state.perPage);

  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) {
      html += `<button data-page="${i}" class="${i === state.page ? 'active' : ''}">${i}</button>`;
    } else if (Math.abs(i - state.page) === 2) {
      html += `<span style="padding:0 0.5rem;">…</span>`;
    }
  }
  html += `<button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;

  el.innerHTML = html;
  el.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = parseInt(btn.dataset.page);
      loadUsers();
    });
  });
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  let timeout;
  document.getElementById('search-users').addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadUsers();
    }, 300);
  });

  document.getElementById('filter-role').addEventListener('change', (e) => {
    state.role = e.target.value;
    state.page = 1;
    loadUsers();
  });
}