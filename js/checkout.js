// js/checkout.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

const SHIPPING_FEE = 5.00;
const FREE_SHIPPING_FROM = 100;

let state = {
  user: null,
  cart: null,
  items: [],
  addresses: [],
  selectedAddressId: null
};

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  state.user = user;

  await Promise.all([loadCart(), loadAddresses()]);
  render();
});

/* ============================================================
   CHARGEMENT
   ============================================================ */
async function loadCart() {
  const { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', state.user.id)
    .maybeSingle();

  if (!cart) {
    state.cart = null;
    state.items = [];
    return;
  }
  state.cart = cart;

  const { data: items } = await supabase
    .from('cart_items')
    .select(`
      id, quantity, product_id, variant_id,
      products(
        id, name, price, stock, is_active,
        product_images(image_url, is_primary),
        product_variants(id, size, color, price, stock)
      )
    `)
    .eq('cart_id', cart.id);

  state.items = (items || []).filter(i => i.products && i.products.is_active);
}

async function loadAddresses() {
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', state.user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  state.addresses = data || [];

  // Sélectionner par défaut
  const defaultAddr = state.addresses.find(a => a.is_default);
  state.selectedAddressId = defaultAddr?.id || state.addresses[0]?.id || null;
}

/* ============================================================
   RENDU PRINCIPAL
   ============================================================ */
function render() {
  const container = document.getElementById('checkout-container');

  // Cas 1 : panier vide
  if (state.items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);">
        <div style="font-size:3rem;margin-bottom:1rem;">🛒</div>
        <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Votre panier est vide</h3>
        <p style="color:var(--gris-texte);margin-bottom:1.5rem;">Ajoutez des produits avant de commander.</p>
        <a href="products.html" class="btn btn-primary">Voir les produits</a>
      </div>
    `;
    return;
  }

  // Cas 2 : aucune adresse
  if (state.addresses.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);">
        <div style="font-size:3rem;margin-bottom:1rem;">📍</div>
        <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Aucune adresse enregistrée</h3>
        <p style="color:var(--gris-texte);margin-bottom:1.5rem;">Ajoutez une adresse de livraison pour continuer.</p>
        <button class="btn btn-primary" id="open-new-address">+ Ajouter une adresse</button>
        <a href="cart.html" class="btn btn-outline" style="margin-left:0.5rem;">Retour au panier</a>
      </div>
    `;
    document.getElementById('open-new-address')?.addEventListener('click', () => openAddressModal());
    return;
  }

  // Cas 3 : tout est prêt
  renderCheckout();
}

function renderCheckout() {
  const container = document.getElementById('checkout-container');

  // Calculs
  const subtotal = state.items.reduce((s, i) => {
    return s + getItemPrice(i) * i.quantity;
  }, 0);
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  // Adresses en HTML
  const addressesHtml = state.addresses.map(a => `
    <label class="address-option ${state.selectedAddressId === a.id ? 'selected' : ''}" data-address-id="${a.id}">
      <input type="radio" name="address" value="${a.id}" ${state.selectedAddressId === a.id ? 'checked' : ''}>
      <div class="address-content">
        <div class="address-header">
          <strong>${a.full_name}</strong>
          ${a.is_default ? '<span class="badge badge-active" style="font-size:0.7rem;">Par défaut</span>' : ''}
        </div>
        <div class="address-line">${a.street}</div>
        <div class="address-line">${a.city}${a.region ? `, ${a.region}` : ''} — ${a.country}</div>
        ${a.phone ? `<div class="address-line">📞 ${a.phone}</div>` : ''}
      </div>
    </label>
  `).join('');

  // Articles
  const itemsHtml = state.items.map(item => {
    const p = item.products;
    const img = p.product_images?.find(i => i.is_primary)?.image_url
      || p.product_images?.[0]?.image_url
      || 'https://via.placeholder.com/80?text=?';
    const variant = item.variant_id
      ? p.product_variants?.find(v => v.id === item.variant_id)
      : null;
    const price = getItemPrice(item);

    return `
      <div class="checkout-item">
        <img src="${img}" alt="${p.name}">
        <div class="checkout-item-info">
          <div class="checkout-item-name">${p.name}</div>
          ${variant ? `<div class="checkout-item-variant">${[variant.size, variant.color].filter(Boolean).join(' · ')}</div>` : ''}
          <div class="checkout-item-qty">Quantité : ${item.quantity}</div>
        </div>
        <div class="checkout-item-price">${formatPrice(price * item.quantity)}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="checkout-layout">
      <div class="checkout-main">
        
        <div class="checkout-block">
          <div class="checkout-block-header">
            <h3>📍 Adresse de livraison</h3>
            <button class="btn btn-ghost" id="add-new-address" style="font-size:0.85rem;">
              + Nouvelle adresse
            </button>
          </div>
          <div class="address-list">
            ${addressesHtml}
          </div>
        </div>

        <div class="checkout-block">
          <h3>📦 Récapitulatif</h3>
          <div class="checkout-items">
            ${itemsHtml}
          </div>
        </div>

        <div class="checkout-block">
  <h3>💳 Mode de paiement</h3>
  <div class="payment-options">
    <label class="payment-option" data-method="cod">
      <input type="radio" name="payment" value="cod" checked>
      <div class="payment-option-content">
        <div class="payment-option-icon">
          <i data-lucide="banknote"></i>
        </div>
        <div>
          <strong>Paiement à la livraison</strong>
          <p>Payez en espèces à la réception de votre commande</p>
        </div>
      </div>
    </label>

    <label class="payment-option" data-method="orange_money">
      <input type="radio" name="payment" value="orange_money">
      <div class="payment-option-content">
        <div class="payment-option-icon payment-option-icon--orange">
          <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FF7900'><circle cx='12' cy='12' r='10'/></svg>" alt="Orange">
        </div>
        <div>
          <strong>Orange Money</strong>
          <p>Paiement mobile via Orange Cameroun</p>
        </div>
      </div>
    </label>

    <label class="payment-option" data-method="mtn_momo">
      <input type="radio" name="payment" value="mtn_momo">
      <div class="payment-option-content">
        <div class="payment-option-icon payment-option-icon--mtn">
          <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FFCC00'><rect x='4' y='4' width='16' height='16' rx='3'/></svg>" alt="MTN">
        </div>
        <div>
          <strong>MTN Mobile Money</strong>
          <p>Paiement mobile via MTN Cameroun</p>
        </div>
      </div>
    </label>
  </div>

  <!-- Champ numéro qui apparaît si MoMo sélectionné -->
  <div id="momo-phone-container" style="display:none;margin-top:1.25rem;">
    <label style="font-size:0.88rem;font-weight:600;display:block;margin-bottom:0.4rem;">
      Numéro <span id="momo-operator-label">Mobile Money</span>
    </label>
    <div style="display:flex;gap:0.5rem;align-items:center;">
      <span style="padding:0.75rem 0.9rem;background:var(--gris-clair);border-radius:var(--radius);font-weight:600;color:var(--gris-texte);">+237</span>
      <input type="tel" id="momo-phone" placeholder="6XX XXX XXX" 
             style="flex:1;padding:0.75rem 0.9rem;border:1.5px solid var(--gris);border-radius:var(--radius);font-family:inherit;font-size:0.95rem;">
    </div>
    <small style="color:var(--gris-texte);font-size:0.8rem;display:block;margin-top:0.35rem;">
      Vous recevrez une notification pour confirmer le paiement.
    </small>
  </div>
</div>

      </div>

      <aside class="checkout-summary">
        <h3>Total</h3>
        <div class="summary-line">
          <span>Sous-total</span>
          <span>${formatPrice(subtotal)}</span>
        </div>
        <div class="summary-line">
          <span>Livraison</span>
          <span>${shipping === 0 ? '<strong style="color:var(--success);">Gratuite</strong>' : formatPrice(shipping)}</span>
        </div>
        <div class="summary-total">
          <span>Total</span>
          <span>${formatPrice(total)}</span>
        </div>

        <button class="btn btn-primary btn-block" id="place-order" style="margin-top:1.25rem;">
          ✓ Confirmer la commande
        </button>
        <a href="cart.html" class="btn btn-ghost btn-block" style="margin-top:0.5rem;">
          Modifier le panier
        </a>

        <div class="secure-notice">
          🔒 Vos données sont protégées et votre commande est sécurisée.
        </div>
      </aside>
    </div>
  `;

  bindEvents();
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  // Sélection d'adresse
  document.querySelectorAll('.address-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const id = parseInt(opt.dataset.addressId);
      state.selectedAddressId = id;
      document.querySelectorAll('.address-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input[type="radio"]').checked = true;
    });
  });

  // Sélection du mode de paiement
document.querySelectorAll('.payment-option').forEach(opt => {
  opt.addEventListener('click', () => {
    const method = opt.dataset.method;
    document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.querySelector('input[type="radio"]').checked = true;

    const momoContainer = document.getElementById('momo-phone-container');
    if (method === 'orange_money' || method === 'mtn_momo') {
      momoContainer.style.display = 'block';
      document.getElementById('momo-operator-label').textContent =
        method === 'orange_money' ? 'Orange Money' : 'MTN MoMo';
    } else {
      momoContainer.style.display = 'none';
    }
  });
});

  // Nouvelle adresse
  document.getElementById('add-new-address')?.addEventListener('click', () => openAddressModal());

  // Passer la commande
  document.getElementById('place-order')?.addEventListener('click', placeOrder);
}

/* ============================================================
   AJOUTER UNE ADRESSE
   ============================================================ */
function openAddressModal() {
  // Utilisation de la modale générique d'admin.js ? Non, elle est côté admin.
  // On fait une modale simple ici.
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'address-modal';
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>Nouvelle adresse</h3>
        <button class="modal-close" id="addr-close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" id="addr-fullname" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Téléphone</label>
            <input type="tel" id="addr-phone">
          </div>
          <div class="form-group">
            <label>Libellé (ex: Maison)</label>
            <input type="text" id="addr-label">
          </div>
        </div>
        <div class="form-group">
          <label>Rue / Adresse *</label>
          <input type="text" id="addr-street" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Ville *</label>
            <input type="text" id="addr-city" required>
          </div>
          <div class="form-group">
            <label>Région</label>
            <input type="text" id="addr-region">
          </div>
        </div>
        <div class="form-group">
          <label>Pays *</label>
          <input type="text" id="addr-country" value="Cameroun" required>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <input type="checkbox" id="addr-default">
            Définir comme adresse par défaut
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="addr-cancel">Annuler</button>
        <button class="btn btn-primary" id="addr-save">Enregistrer</button>
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

    // Si c'est la 1ère adresse, la mettre par défaut
    if (state.addresses.length === 0) payload.is_default = true;

    // Si on définit comme défaut, retirer le défaut des autres
    if (payload.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', state.user.id);
    }

    const { data, error } = await supabase
      .from('addresses')
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert('Erreur : ' + error.message);
      return;
    }

    // Recharger les adresses
    await loadAddresses();
    state.selectedAddressId = data.id;

    close();
    render();
  });
}

async function placeOrder() {
  if (!state.selectedAddressId) {
    alert('Veuillez sélectionner une adresse.');
    return;
  }

  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';

  // Validation numéro MoMo
  if (paymentMethod === 'orange_money' || paymentMethod === 'mtn_momo') {
    const phone = document.getElementById('momo-phone')?.value.trim();
    if (!phone || phone.length < 9) {
      alert('Veuillez saisir un numéro de téléphone valide.');
      return;
    }

    // 🎬 SIMULATION : afficher un écran de traitement
    await simulateMoMoPayment(paymentMethod, phone);
  }

  const btn = document.getElementById('place-order');
  btn.disabled = true;
  btn.textContent = 'Traitement en cours...';

  try {
    const subtotal = state.items.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);
    const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

    const { data, error } = await supabase.rpc('create_order', {
      p_address_id: state.selectedAddressId,
      p_shipping_fee: shipping,
      p_payment_method: paymentMethod
    });

    if (error) { /* ... */ return; }

    showSuccess(data);

  } catch (err) {
    console.error(err);
    alert('Erreur : ' + err.message);
    btn.disabled = false;
    btn.textContent = '✓ Confirmer la commande';
  }
}

/* ============================================================
   SIMULATION PAIEMENT MOBILE MONEY (à remplacer par KPay)
   ============================================================ */
async function simulateMoMoPayment(method, phone) {
  const operator = method === 'orange_money' ? 'Orange Money' : 'MTN Mobile Money';

  // Afficher un écran de traitement plein écran
  const overlay = document.createElement('div');
  overlay.className = 'payment-processing-overlay';
  overlay.innerHTML = `
    <div class="payment-processing-card">
      <div class="payment-spinner"></div>
      <h2>Paiement ${operator}</h2>
      <p>Une demande de paiement a été envoyée au <strong>+237 ${phone}</strong>.</p>
      <p class="payment-processing-hint">Composez le code USSD reçu pour valider.</p>
      <div class="payment-processing-status">
        <span class="payment-dot"></span>
        <span>En attente de confirmation...</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Simuler une attente de 3 secondes
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fermer l'overlay
  overlay.remove();

  return true;
}

/* ============================================================
   ÉCRAN DE SUCCÈS
   ============================================================ */
function showSuccess(order) {
  const container = document.getElementById('checkout-container');

  container.innerHTML = `
    <div style="max-width:640px;margin:0 auto;text-align:center;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);padding:3rem 2rem;">
      <div style="width:80px;height:80px;border-radius:50%;background:var(--success);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2.5rem;margin:0 auto 1.5rem;">
        ✓
      </div>
      <h2 style="color:var(--bleu-nuit);margin-bottom:0.75rem;">Commande confirmée !</h2>
      <p style="color:var(--gris-texte);margin-bottom:2rem;">
        Merci pour votre achat. Vous recevrez bientôt une confirmation.
      </p>

      <div style="background:var(--gris-clair);border-radius:var(--radius);padding:1.5rem;text-align:left;margin-bottom:2rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
          <span style="color:var(--gris-texte);">Numéro de commande</span>
          <strong>#${String(order.order_id).padStart(4, '0')}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
          <span style="color:var(--gris-texte);">Facture</span>
          <strong>${order.invoice_number}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
          <span style="color:var(--gris-texte);">Articles</span>
          <strong>${order.items_count}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:0.75rem;border-top:1px solid var(--gris);margin-top:0.75rem;">
          <span style="font-weight:700;">Total</span>
          <strong style="color:var(--orange);font-size:1.2rem;">${formatPrice(order.total)}</strong>
        </div>
      </div>

      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
        <a href="order-details.html?id=${order.order_id}" class="btn btn-primary">Voir ma commande</a>
        <a href="products.html" class="btn btn-outline">Continuer mes achats</a>
      </div>
    </div>
  `;
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
function getItemPrice(item) {
  const variant = item.variant_id
    ? item.products.product_variants?.find(v => v.id === item.variant_id)
    : null;
  return Number(variant?.price || item.products.price);
}

function formatPrice(n) {
  return Number(n || 0).toFixed(2) + ' €';
}