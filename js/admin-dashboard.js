// js/admin-dashboard.js
import { supabase } from './supabase.js';
import { requireAdmin, renderAdminSidebar, renderAdminUser, formatPrice, formatDate, statusBadge } from './admin.js';

(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  renderAdminSidebar(ctx.profile, 'index.html');
  renderAdminUser(ctx.profile);

  await loadStats();
  await loadOrdersChart();
  await loadRecentOrders();
  await loadLowStock();
})();

/* ============================================================
   STATISTIQUES GLOBALES
   ============================================================ */
async function loadStats() {
  // Utilisateurs
  const { count: usersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Produits
  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  // Commandes
  const { count: ordersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  // CA total (hors annulées)
  const { data: orders } = await supabase
    .from('orders')
    .select('total')
    .neq('status', 'cancelled');

  const revenue = (orders || []).reduce((s, o) => s + Number(o.total), 0);

  document.getElementById('stat-users').textContent = usersCount || 0;
  document.getElementById('stat-products').textContent = productsCount || 0;
  document.getElementById('stat-orders').textContent = ordersCount || 0;
  document.getElementById('stat-revenue').textContent = formatPrice(revenue);
}

/* ============================================================
   GRAPHIQUE : commandes des 7 derniers jours
   ============================================================ */
async function loadOrdersChart() {
  const chartEl = document.getElementById('orders-chart');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('created_at')
    .gte('created_at', sevenDaysAgo.toISOString());

  // Initialiser les 7 jours
  const days = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    days[key] = 0;
  }

  // Compter
  (orders || []).forEach(o => {
    const key = o.created_at.split('T')[0];
    if (days[key] !== undefined) days[key]++;
  });

  const max = Math.max(...Object.values(days), 1);
  const labels = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  chartEl.innerHTML = Object.entries(days).map(([date, count]) => {
    const d = new Date(date);
    const height = (count / max) * 100;
    return `
      <div class="chart-bar-wrapper">
        <div style="font-size:0.8rem;font-weight:700;color:var(--bleu-nuit);margin-bottom:0.35rem;">${count}</div>
        <div class="chart-bar" style="height:${Math.max(height, 4)}%;"></div>
        <div class="chart-label">${labels[d.getDay()]}<br>${d.getDate()}/${d.getMonth() + 1}</div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   DERNIÈRES COMMANDES
   ============================================================ */
async function loadRecentOrders() {
  const el = document.getElementById('recent-orders');

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total, created_at, user_id, profiles(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!orders || orders.length === 0) {
    el.innerHTML = '<p style="color:var(--gris-texte);padding:1rem 0;">Aucune commande pour le moment.</p>';
    return;
  }

  el.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>N°</th>
          <th>Client</th>
          <th>Total</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td>#${String(o.id).padStart(4, '0')}</td>
            <td>${o.profiles ? `${o.profiles.first_name || ''} ${o.profiles.last_name || ''}`.trim() : '—'}</td>
            <td><strong>${formatPrice(o.total)}</strong></td>
            <td>${statusBadge(o.status)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ============================================================
   PRODUITS EN STOCK FAIBLE
   ============================================================ */
async function loadLowStock() {
  const el = document.getElementById('low-stock');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, stock, product_images(image_url, is_primary)')
    .eq('is_active', true)
    .lt('stock', 10)
    .order('stock', { ascending: true })
    .limit(5);

  if (!products || products.length === 0) {
    el.innerHTML = '<p style="color:var(--success);padding:1rem 0;">✓ Tous les stocks sont bons !</p>';
    return;
  }

  el.innerHTML = products.map(p => {
    const img = p.product_images?.find(i => i.is_primary)?.image_url
      || p.product_images?.[0]?.image_url
      || 'https://via.placeholder.com/48';

    return `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--gris);">
        <img src="${img}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;">
        <div style="flex:1;">
          <div style="font-weight:600;font-size:0.9rem;">${p.name}</div>
          <div style="font-size:0.82rem;color:${p.stock === 0 ? 'var(--error)' : 'var(--warning)'};font-weight:600;">
            ${p.stock === 0 ? 'Rupture de stock' : `Stock : ${p.stock}`}
          </div>
        </div>
      </div>
    `;
  }).join('');
}