// js/order-details.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';
import { generateInvoice } from './invoice.js';

const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const STATUS_META = {
  pending:    { label: 'En attente',      icon: 'clock',           color: '#f59e0b' },
  confirmed:  { label: 'Confirmée',       icon: 'check-circle',    color: '#3b82f6' },
  processing: { label: 'En préparation',  icon: 'package',         color: '#8b5cf6' },
  shipped:    { label: 'Expédiée',        icon: 'truck',           color: '#06b6d4' },
  delivered:  { label: 'Livrée',          icon: 'home',            color: '#10b981' },
  cancelled:  { label: 'Annulée',         icon: 'x-circle',        color: '#ef4444' }
};

const PAYMENT_LABELS = {
  cod: 'Paiement à la livraison',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN Mobile Money',
  card: 'Carte bancaire'
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

/* ============================================================
   CHARGEMENT
   ============================================================ */
async function loadOrder(orderId, userId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      addresses(full_name, phone, street, city, region, country, label),
      order_items(id, product_name, price, quantity, product_id, variant_id)
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

/* ============================================================
   RENDU PRINCIPAL
   ============================================================ */
function renderOrder(order) {
  const container = document.getElementById('order-detail-container');
  const addr = order.addresses;
  const num = `#${String(order.id).padStart(4, '0')}`;
  const meta = STATUS_META[order.status] || STATUS_META.pending;

  const itemsHtml = order.order_items.map(item => `
    <div class="order-item-row">
      <div class="order-item-icon">
        <i data-lucide="package"></i>
      </div>
      <div class="order-item-info">
        <div class="order-item-name">${item.product_name}</div>
        <div class="order-item-meta">
          <span>Quantité : <strong>${item.quantity}</strong></span>
          <span>Prix unitaire : <strong>${formatPrice(item.price)}</strong></span>
        </div>
      </div>
      <div class="order-item-total">${formatPrice(item.price * item.quantity)}</div>
    </div>
  `).join('');

  const addrHtml = addr ? `
    <div class="order-address">
      <div class="order-address-line">
        <i data-lucide="user"></i>
        <span><strong>${addr.full_name}</strong></span>
      </div>
      ${addr.phone ? `
        <div class="order-address-line">
          <i data-lucide="phone"></i>
          <span>${addr.phone}</span>
        </div>
      ` : ''}
      <div class="order-address-line">
        <i data-lucide="map-pin"></i>
        <span>
          ${addr.street}<br>
          ${addr.city}${addr.region ? `, ${addr.region}` : ''}<br>
          ${addr.country}
        </span>
      </div>
    </div>
  ` : '<p style="color:var(--gris-texte);">Aucune adresse.</p>';

  // Timeline
  const currentIndex = STATUS_FLOW.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  const timelineHtml = isCancelled ? `
    <div class="order-timeline cancelled">
      <div class="timeline-step active">
        <div class="timeline-icon" style="background:var(--error);color:white;">
          <i data-lucide="x-circle"></i>
        </div>
        <div class="timeline-label">Commande annulée</div>
      </div>
    </div>
  ` : `
    <div class="order-timeline">
      ${STATUS_FLOW.map((step, i) => {
        const stepMeta = STATUS_META[step];
        const isDone = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return `
          <div class="timeline-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}">
            <div class="timeline-icon">
              <i data-lucide="${stepMeta.icon}"></i>
            </div>
            <div class="timeline-label">${stepMeta.label}</div>
            ${i < STATUS_FLOW.length - 1 ? '<div class="timeline-line"></div>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="index.html">Accueil</a>
      <i data-lucide="chevron-right"></i>
      <a href="orders.html">Mes commandes</a>
      <i data-lucide="chevron-right"></i>
      <span>${num}</span>
    </div>

    <!-- En-tête commande -->
    <div class="order-header">
      <div class="order-header-left">
        <div class="order-header-icon" style="background:${meta.color}15;color:${meta.color};">
          <i data-lucide="receipt"></i>
        </div>
        <div>
          <h1>Commande ${num}</h1>
          <p class="order-header-date">
            <i data-lucide="calendar" style="width:14px;height:14px;"></i>
            Passée le ${formatDate(order.created_at)}
          </p>
        </div>
      </div>
      <span class="order-status-badge" style="background:${meta.color}15;color:${meta.color};border:1px solid ${meta.color}40;">
        <i data-lucide="${meta.icon}" style="width:14px;height:14px;"></i>
        ${meta.label}
      </span>
    </div>

    <!-- Timeline de suivi -->
    <div class="order-block">
      <div class="order-block-header">
        <i data-lucide="truck"></i>
        <h3>Suivi de votre commande</h3>
      </div>
      ${timelineHtml}
    </div>

    <!-- Layout principal -->
    <div class="order-layout">

      <!-- Colonne gauche -->
      <div class="order-main">

        <div class="order-block">
          <div class="order-block-header">
            <i data-lucide="package-check"></i>
            <h3>Articles commandés (${order.order_items.length})</h3>
          </div>
          <div class="order-items-list">
            ${itemsHtml}
          </div>
        </div>

        <div class="order-block">
          <div class="order-block-header">
            <i data-lucide="map-pin"></i>
            <h3>Adresse de livraison</h3>
          </div>
          ${addrHtml}
        </div>

        <div class="order-block">
          <div class="order-block-header">
            <i data-lucide="credit-card"></i>
            <h3>Mode de paiement</h3>
          </div>
          <div class="order-payment">
            <i data-lucide="${order.payment_method === 'cod' ? 'banknote' : 'smartphone'}"></i>
            <span>${PAYMENT_LABELS[order.payment_method] || 'Paiement à la livraison'}</span>
          </div>
        </div>

      </div>

      <!-- Colonne droite : récapitulatif -->
      <aside class="order-summary">
        <div class="order-summary-header">
          <i data-lucide="wallet"></i>
          <h3>Récapitulatif</h3>
        </div>

        <div class="summary-line">
          <span>Sous-total</span>
          <span>${formatPrice(order.subtotal)}</span>
        </div>

        <div class="summary-line">
          <span>Livraison</span>
          <span>${Number(order.shipping_fee) === 0
            ? '<strong style="color:var(--success);">Gratuite</strong>'
            : formatPrice(order.shipping_fee)}</span>
        </div>

        ${order.invoice_number ? `
          <div class="summary-line" style="font-size:0.85rem;">
            <span>Facture</span>
            <span><code>${order.invoice_number}</code></span>
          </div>
        ` : ''}

        <div class="summary-total">
          <span>Total</span>
          <span>${formatPrice(order.total)}</span>
        </div>

        <div class="order-actions">
          <button class="btn btn-primary btn-block" id="download-invoice">
            <i data-lucide="download" style="width:16px;height:16px;"></i>
            Télécharger la facture
          </button>
          <button class="btn btn-outline btn-block" id="contact-support">
            <i data-lucide="message-circle" style="width:16px;height:16px;"></i>
            Contacter le support
          </button>
          <a href="orders.html" class="btn btn-ghost btn-block">
            <i data-lucide="arrow-left" style="width:16px;height:16px;"></i>
            Retour à mes commandes
          </a>
        </div>
      </aside>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Actions
document.getElementById('download-invoice')?.addEventListener('click', async () => {
  const btn = document.getElementById('download-invoice');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite;">⟳</span> Génération...';

  try {
    await generateInvoice(order);
  } catch (err) {
    console.error('Erreur PDF :', err);
    alert('Impossible de générer la facture : ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});
  document.getElementById('contact-support')?.addEventListener('click', () => {
    alert('Le chat de support arrive bientôt !');
  });
}

/* ============================================================
   ERREUR
   ============================================================ */
function showError(msg) {
  document.getElementById('order-detail-container').innerHTML = `
    <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);max-width:520px;margin:3rem auto;">
      <div style="font-size:3rem;color:var(--error);margin-bottom:1rem;">
        <i data-lucide="alert-circle" style="width:60px;height:60px;"></i>
      </div>
      <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Oups !</h3>
      <p style="color:var(--gris-texte);margin-bottom:1.5rem;">${msg}</p>
      <a href="orders.html" class="btn btn-primary">Retour à mes commandes</a>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
function formatPrice(n) {
  return Number(n || 0).toFixed(2) + ' €';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}