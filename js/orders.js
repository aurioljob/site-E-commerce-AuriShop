// js/orders.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée'
};

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  await loadOrders(user.id);
});

async function loadOrders(userId) {
  const container = document.getElementById('orders-container');

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, status, total, subtotal, shipping_fee, invoice_number, created_at,
      order_items(id, product_name, quantity, price)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="error" style="text-align:center;padding:2rem;">Erreur : ${error.message}</p>`;
    return;
  }

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);">
        <div style="font-size:3rem;margin-bottom:1rem;">📦</div>
        <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Aucune commande</h3>
        <p style="color:var(--gris-texte);margin-bottom:1.5rem;">Vous n'avez pas encore passé de commande.</p>
        <a href="products.html" class="btn btn-primary">Découvrir les produits</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1rem;">
      ${orders.map(o => {
        const itemsCount = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0;
        const previewNames = (o.order_items || []).slice(0, 3).map(i => i.product_name).join(', ');
        const moreCount = (o.order_items?.length || 0) - 3;

        return `
          <div class="admin-panel" style="margin:0;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
              <div>
                <div style="font-weight:700;color:var(--bleu-nuit);font-size:1.05rem;">
                  Commande #${String(o.id).padStart(4, '0')}
                </div>
                <div style="font-size:0.85rem;color:var(--gris-texte);margin-top:0.25rem;">
                  ${formatDate(o.created_at)} · ${itemsCount} article${itemsCount > 1 ? 's' : ''}
                </div>
              </div>
              <span class="badge badge-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
            </div>

            <div style="font-size:0.9rem;color:var(--gris-texte);margin-bottom:1rem;">
              ${previewNames}${moreCount > 0 ? ` et ${moreCount} autre${moreCount > 1 ? 's' : ''}` : ''}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;padding-top:1rem;border-top:1px solid var(--gris);">
              <div>
                <span style="color:var(--gris-texte);font-size:0.85rem;">Total :</span>
                <strong style="color:var(--orange);font-size:1.2rem;margin-left:0.35rem;">${formatPrice(o.total)}</strong>
              </div>
              <a href="order-details.html?id=${o.id}" class="btn btn-outline" style="font-size:0.85rem;">
                Voir les détails →
              </a>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function formatPrice(n) { return Number(n || 0).toFixed(2) + ' €'; }
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}