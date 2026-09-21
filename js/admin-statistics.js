// js/admin-statistics.js
import { supabase } from './supabase.js';
import {
  requireAdmin,
  renderAdminSidebar,
  renderAdminUser,
  formatPrice
} from './admin.js';

(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  renderAdminSidebar(ctx.profile, 'statistics.html');
  renderAdminUser(ctx.profile);

  await loadKpis();
  await loadTopProducts();
  await loadStatusDistribution();
  await loadTopCustomers();
})();

/* ============================================================
   KPIs
   ============================================================ */
async function loadKpis() {
  const { data: orders } = await supabase
    .from('orders')
    .select('total, status');

  const valid = (orders || []).filter(o => o.status !== 'cancelled');
  const revenue = valid.reduce((s, o) => s + Number(o.total), 0);
  const avg = valid.length ? revenue / valid.length : 0;
  const cancelled = (orders || []).filter(o => o.status === 'cancelled').length;
  const total = orders?.length || 0;
  const cancelRate = total ? (cancelled / total) * 100 : 0;

  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('is_approved', true);
  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  document.getElementById('s-revenue').textContent = formatPrice(revenue);
  document.getElementById('s-avg').textContent = formatPrice(avg);
  document.getElementById('s-rating').textContent = avgRating === '—' ? '—' : `${avgRating}/5`;
  document.getElementById('s-cancel').textContent = cancelRate.toFixed(1) + '%';
}

/* ============================================================
   TOP PRODUITS
   ============================================================ */
async function loadTopProducts() {
  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, product_name, quantity, price, orders(status)');

  const stats = {};
  (items || []).forEach(i => {
    if (i.orders?.status === 'cancelled') return;
    if (!stats[i.product_id]) {
      stats[i.product_id] = { name: i.product_name, qty: 0, revenue: 0 };
    }
    stats[i.product_id].qty += i.quantity;
    stats[i.product_id].revenue += i.quantity * Number(i.price);
  });

  const top = Object.values(stats).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const el = document.getElementById('top-products');

  if (top.length === 0) {
    el.innerHTML = '<p style="color:var(--gris-texte);text-align:center;padding:1.5rem;">Aucune vente enregistrée.</p>';
    return;
  }

  el.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>#</th><th>Produit</th><th>Qté vendue</th><th>CA généré</th></tr></thead>
      <tbody>
        ${top.map((p, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td>${p.name}</td>
            <td>${p.qty}</td>
            <td><strong>${formatPrice(p.revenue)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ============================================================
   RÉPARTITION PAR STATUT
   ============================================================ */
async function loadStatusDistribution() {
  const { data: orders } = await supabase.from('orders').select('status');
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    processing: 'En préparation',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée'
  };

  const counts = {};
  (orders || []).forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });

  const total = orders?.length || 0;
  const el = document.getElementById('status-distribution');

  if (total === 0) {
    el.innerHTML = '<p style="color:var(--gris-texte);text-align:center;padding:1.5rem;">Aucune commande.</p>';
    return;
  }

  el.innerHTML = Object.entries(labels).map(([key, label]) => {
    const count = counts[key] || 0;
    const pct = total ? (count / total) * 100 : 0;
    return `
      <div style="margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:0.35rem;">
          <span>${label}</span>
          <span><strong>${count}</strong> (${pct.toFixed(1)}%)</span>
        </div>
        <div style="background:var(--gris-clair);height:8px;border-radius:4px;overflow:hidden;">
          <div style="background:var(--orange);height:100%;width:${pct}%;transition:width 0.5s;"></div>
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   TOP CLIENTS
   ============================================================ */
async function loadTopCustomers() {
  const { data: orders } = await supabase
    .from('orders')
    .select('user_id, total, status, profiles(first_name, last_name)')
    .neq('status', 'cancelled');

  const stats = {};
  (orders || []).forEach(o => {
    if (!stats[o.user_id]) {
      stats[o.user_id] = {
        name: o.profiles ? `${o.profiles.first_name || ''} ${o.profiles.last_name || ''}`.trim() : '—',
        count: 0,
        revenue: 0
      };
    }
    stats[o.user_id].count++;
    stats[o.user_id].revenue += Number(o.total);
  });

  const top = Object.values(stats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const el = document.getElementById('top-customers');

  if (top.length === 0) {
    el.innerHTML = '<p style="color:var(--gris-texte);text-align:center;padding:1.5rem;">Aucun client avec commande.</p>';
    return;
  }

  el.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>#</th><th>Client</th><th>Commandes</th><th>CA total</th></tr></thead>
      <tbody>
        ${top.map((c, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td>${c.name || '—'}</td>
            <td>${c.count}</td>
            <td><strong>${formatPrice(c.revenue)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}