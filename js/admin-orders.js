// js/admin-orders.js
import { supabase } from './supabase.js';
import {
  requireAdmin,
  renderAdminSidebar,
  renderAdminUser,
  formatPrice,
  formatDate,
  statusBadge,
  openModal
} from './admin.js';

const STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'processing', label: 'En préparation' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' }
];

let state = {
  page: 1,
  perPage: 10,
  total: 0,
  search: '',
  status: ''
};

(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  renderAdminSidebar(ctx.profile, 'orders.html');
  renderAdminUser(ctx.profile);

  await loadOrders();
  bindEvents();
})();

/* ============================================================
   LISTE DES COMMANDES
   ============================================================ */
async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Chargement...</td></tr>';

  let query = supabase
    .from('orders')
    .select(`
      id, status, total, subtotal, shipping_fee, created_at,
      profiles(first_name, last_name),
      order_items(id, quantity)
    `, { count: 'exact' });

  if (state.status) {
    query = query.eq('status', state.status);
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

  // Filtre recherche côté client (sur n° et nom client)
  let filtered = data || [];
  if (state.search) {
    const s = state.search.toLowerCase();
    filtered = filtered.filter(o => {
      const num = String(o.id).padStart(4, '0');
      const name = o.profiles ? `${o.profiles.first_name} ${o.profiles.last_name}`.toLowerCase() : '';
      return num.includes(s) || name.includes(s) || String(o.id).includes(s);
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gris-texte);">Aucune commande trouvée.</td></tr>';
    renderPagination();
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const num = `#${String(o.id).padStart(4, '0')}`;
    const client = o.profiles
      ? `${o.profiles.first_name || ''} ${o.profiles.last_name || ''}`.trim() || '—'
      : '—';
    const itemsCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0;

    return `
      <tr>
        <td><strong>${num}</strong></td>
        <td>${client}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>${itemsCount} article${itemsCount > 1 ? 's' : ''}</td>
        <td><strong>${formatPrice(o.total)}</strong></td>
        <td>${statusBadge(o.status)}</td>
        <td>
            <div class="table-actions">
                <button class="icon-btn" data-action="view" data-id="${o.id}" title="Voir détails">
                <i data-lucide="eye" style="width:16px;height:16px;"></i>
                </button>
                <button class="icon-btn" data-action="edit-status" data-id="${o.id}" data-status="${o.status}" title="Changer statut">
                <i data-lucide="refresh-cw" style="width:16px;height:16px;"></i>
                </button>
            </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'view') viewOrder(id);
      else if (btn.dataset.action === 'edit-status') changeStatus(id, btn.dataset.status);
    });
    if (window.lucide) window.lucide.createIcons();
  });

  renderPagination();
}

/* ============================================================
   VOIR DÉTAILS D'UNE COMMANDE
   ============================================================ */
async function viewOrder(id) {
  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      profiles(first_name, last_name, phone),
      addresses(full_name, phone, street, city, region, country),
      order_items(id, product_name, price, quantity, product_id)
    `)
    .eq('id', id)
    .single();

  if (!order) {
    alert('Commande introuvable.');
    return;
  }

  const itemsHtml = order.order_items.map(item => `
    <tr>
      <td>${item.product_name}</td>
      <td>${item.quantity}×</td>
      <td>${formatPrice(item.price)}</td>
      <td style="text-align:right;"><strong>${formatPrice(item.price * item.quantity)}</strong></td>
    </tr>
  `).join('');

  const addr = order.addresses;
  const addrHtml = addr ? `
    <div style="background:var(--gris-clair);padding:1rem;border-radius:8px;font-size:0.9rem;line-height:1.6;">
      <strong>${addr.full_name}</strong><br>
      ${addr.phone ? `📞 ${addr.phone}<br>` : ''}
      ${addr.street}<br>
      ${addr.city}${addr.region ? `, ${addr.region}` : ''}<br>
      ${addr.country}
    </div>
  ` : '<p>Aucune adresse.</p>';

  const bodyHtml = `
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
        <div><strong style="font-size:1.1rem;">Commande #${String(order.id).padStart(4, '0')}</strong></div>
        <div>${statusBadge(order.status)}</div>
      </div>
      <div style="font-size:0.85rem;color:var(--gris-texte);margin-top:0.5rem;">
        Passée le ${formatDate(order.created_at)}
      </div>
    </div>

    <h4 style="margin-bottom:0.5rem;">Client</h4>
    <p style="margin-bottom:1rem;font-size:0.9rem;">
      ${order.profiles ? `${order.profiles.first_name || ''} ${order.profiles.last_name || ''}` : '—'}
      ${order.profiles?.phone ? `<br>📞 ${order.profiles.phone}` : ''}
    </p>

    <h4 style="margin-bottom:0.5rem;">Adresse de livraison</h4>
    <div style="margin-bottom:1.5rem;">${addrHtml}</div>

    <h4 style="margin-bottom:0.5rem;">Articles</h4>
    <table class="admin-table" style="margin-bottom:1rem;">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Qté</th>
          <th>Prix</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div style="text-align:right;font-size:0.95rem;line-height:1.8;">
      <div>Sous-total : <strong>${formatPrice(order.subtotal)}</strong></div>
      <div>Livraison : <strong>${formatPrice(order.shipping_fee)}</strong></div>
      <div style="font-size:1.1rem;margin-top:0.5rem;">
        Total : <strong style="color:var(--orange);">${formatPrice(order.total)}</strong>
      </div>
    </div>
  `;

  openModal({
    title: 'Détails de la commande',
    bodyHtml,
    confirmLabel: 'Fermer',
    onConfirm: async () => true
  });
}

/* ============================================================
   CHANGER LE STATUT
   ============================================================ */
function changeStatus(id, currentStatus) {
  const options = STATUSES.map(s =>
    `<option value="${s.value}" ${s.value === currentStatus ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  const bodyHtml = `
    <div class="form-group">
      <label>Nouveau statut</label>
      <select id="new-status">${options}</select>
    </div>
    <p style="font-size:0.85rem;color:var(--gris-texte);">
      Le client sera notifié du changement de statut (si les notifications sont activées).
    </p>
  `;

  openModal({
    title: 'Changer le statut',
    bodyHtml,
    confirmLabel: 'Mettre à jour',
    onConfirm: async () => {
      const newStatus = document.getElementById('new-status').value;
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id)
        .select('id, status')
        .maybeSingle();

      if (error) {
        alert('Erreur : ' + error.message);
        return false;
      }

      if (!updatedOrder) {
        alert('La commande n\'a pas été modifiée. Vérifiez vos droits Supabase (policy RLS).');
        return false;
      }

      await loadOrders();
      return true;
    }
  });
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
  const el = document.getElementById('orders-pagination');
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
      loadOrders();
    });
  });
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  let timeout;
  document.getElementById('search-orders').addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      state.search = e.target.value.trim();
      loadOrders();
    }, 300);
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadOrders();
  });
}