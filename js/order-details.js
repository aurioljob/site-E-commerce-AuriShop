// js/order-details.js
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

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');
  if (!orderId) { showError('Commande introuvable.'); return; }

  await loadOrder(orderId, user.id);
});

async function loadOrder(orderId, userId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      addresses(full_name, phone, street, city, region, country, label),
      order_items(id, product_name, price, quantity, product_id)
    `)
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !order) {
    showError('Commande introuvable ou accès refusé.');
    return;
  }

  renderOrder(order);
}

function renderOrder(order) {
  const container = document.getElementById('order-detail-container');
  const addr = order.addresses;

  const itemsHtml = order.order_items.map(item => `
    <tr>
      <td>${item.product_name}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">${formatPrice(item.price)}</td>
      <td style="text-align:right;"><strong>${formatPrice(item.price * item.quantity)}</strong></td>
    </tr>
  `).join('');

  const addrHtml = addr ? `
    <div style="line-height:1.7;font-size:0.9rem;">
      <strong>${addr.full_name}</strong><br>
      ${addr.phone ? `📞 ${addr.phone}<br>` : ''}
      ${addr.street}<br>
      ${addr.city}${addr.region ? `, ${addr.region}` : ''}<br>
      ${addr.country}
    </div>
  ` : '<p>Aucune adresse.</p>';

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="index.html">Accueil</a> ›
      <a href="orders.html">Mes commandes</a> ›
      <span>#${String(order.id).padStart(4, '0')}</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:2rem;">
      <div>
        <h1 style="color:var(--bleu-nuit);margin-bottom:0.35rem;">Commande #${String(order.id).padStart(4, '0')}</h1>
        <p style="color:var(--gris-texte);font-size:0.9rem;">
          Passée le ${formatDate(order.created_at)}
        </p>
      </div>
      <span class="badge badge-${order.status}" style="font-size:0.85rem;padding:0.5rem 1rem;">
        ${STATUS_LABELS[order.status] || order.status}
      </span>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem;align-items:start;">
      <div>
        <div class="admin-panel">
          <h3 style="margin-bottom:1rem;color:var(--bleu-nuit);font-size:1.05rem;">Articles commandés</h3>
          <table class="admin-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th style="text-align:center;">Qté</th>
                <th style="text-align:right;">Prix</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>

        <div class="admin-panel">
          <h3 style="margin-bottom:1rem;color:var(--bleu-nuit);font-size:1.05rem;">📍 Adresse de livraison</h3>
          ${addrHtml}
        </div>
      </div>

      <aside class="admin-panel" style="position:sticky;top:90px;">
        <h3 style="margin-bottom:1rem;color:var(--bleu-nuit);font-size:1.05rem;">💰 Récapitulatif</h3>
        <div class="summary-line">
          <span>Sous-total</span>
          <span>${formatPrice(order.subtotal)}</span>
        </div>
        <div class="summary-line">
          <span>Livraison</span>
          <span>${Number(order.shipping_fee) === 0 ? '<strong style="color:var(--success);">Gratuite</strong>' : formatPrice(order.shipping_fee)}</span>
        </div>
        <div class="summary-total">
          <span>Total</span>
          <span>${formatPrice(order.total)}</span>
        </div>

        ${order.invoice_number ? `
          <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gris);font-size:0.85rem;color:var(--gris-texte);">
            Facture : <strong>${order.invoice_number}</strong>
          </div>
        ` : ''}

        <a href="orders.html" class="btn btn-outline btn-block" style="margin-top:1.5rem;">
          ← Mes commandes
        </a>
      </aside>
    </div>
  `;
}

function showError(msg) {
  document.getElementById('order-detail-container').innerHTML = `
    <div style="text-align:center;padding:3rem;color:var(--error);">
      <p>${msg}</p>
      <a href="orders.html" class="btn btn-primary" style="margin-top:1rem;">Retour à mes commandes</a>
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