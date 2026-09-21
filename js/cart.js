// js/cart.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

const SHIPPING_FEE = 5.00;       // Frais de livraison fixes
const FREE_SHIPPING_FROM = 100;  // Livraison gratuite à partir de 100€

let cartData = null;

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    renderNotLoggedIn();
    return;
  }

  await loadCart();
});

/* ============================================================
   CAS : utilisateur non connecté
   ============================================================ */
function renderNotLoggedIn() {
  const container = document.getElementById('cart-container');
  container.innerHTML = `
    <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);">
      <div style="font-size:3rem;margin-bottom:1rem;">🔒</div>
      <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Connectez-vous pour voir votre panier</h3>
      <p style="color:var(--gris-texte);margin-bottom:1.5rem;">Votre panier est sauvegardé avec votre compte.</p>
      <a href="login.html" class="btn btn-primary">Se connecter</a>
      <a href="products.html" class="btn btn-outline" style="margin-left:0.5rem;">Continuer mes achats</a>
    </div>
  `;
  document.getElementById('cart-subtitle').textContent = '';
}

/* ============================================================
   CHARGEMENT DU PANIER
   ============================================================ */
async function loadCart() {
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Récupérer ou créer le panier de l'utilisateur
  let { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!cart) {
    const { data: newCart } = await supabase
      .from('carts')
      .insert({ user_id: user.id })
      .select('id')
      .single();
    cart = newCart;
  }

  if (!cart) {
    renderError('Impossible de créer le panier.');
    return;
  }

  // 2. Récupérer les articles avec les infos produit
  const { data: items, error } = await supabase
    .from('cart_items')
    .select(`
      id, quantity, product_id, variant_id,
      products(
        id, name, slug, price, old_price, stock, is_active,
        product_images(image_url, is_primary),
        product_variants(id, size, color, price, stock)
      )
    `)
    .eq('cart_id', cart.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    renderError('Erreur de chargement du panier.');
    return;
  }

  cartData = {
    cartId: cart.id,
    items: items || []
  };

  renderCart();
}

/* ============================================================
   RENDU DU PANIER
   ============================================================ */
function renderCart() {
  const container = document.getElementById('cart-container');
  const subtitle = document.getElementById('cart-subtitle');
  const items = cartData.items.filter(i => i.products && i.products.is_active);

  if (items.length === 0) {
    subtitle.textContent = '';
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);">
        <div style="font-size:3rem;margin-bottom:1rem;">🛒</div>
        <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Votre panier est vide</h3>
        <p style="color:var(--gris-texte);margin-bottom:1.5rem;">Ajoutez des produits pour commencer.</p>
        <a href="products.html" class="btn btn-primary">Découvrir les produits</a>
      </div>
    `;
    return;
  }

  const subtotal = items.reduce((s, i) => {
    const price = getItemPrice(i);
    return s + price * i.quantity;
  }, 0);

  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  subtitle.textContent = `${items.length} article${items.length > 1 ? 's' : ''} dans votre panier`;

  container.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items">
        ${items.map(item => renderItem(item)).join('')}
      </div>

      <aside class="cart-summary">
        <h3>Récapitulatif</h3>

        <div class="summary-line">
          <span>Sous-total</span>
          <span>${formatPrice(subtotal)}</span>
        </div>
        <div class="summary-line">
          <span>Livraison</span>
          <span>${shipping === 0 ? '<strong style="color:var(--success);">Gratuite</strong>' : formatPrice(shipping)}</span>
        </div>

        ${subtotal < FREE_SHIPPING_FROM && subtotal > 0 ? `
          <div class="free-shipping-hint">
            💡 Plus que <strong>${formatPrice(FREE_SHIPPING_FROM - subtotal)}</strong> pour la livraison gratuite !
          </div>
        ` : ''}

        <div class="summary-total">
          <span>Total</span>
          <span>${formatPrice(total)}</span>
        </div>

        <a href="checkout.html" class="btn btn-primary btn-block" style="margin-top:1.25rem;">
          Passer la commande →
        </a>
        <a href="products.html" class="btn btn-ghost btn-block" style="margin-top:0.5rem;">
          Continuer mes achats
        </a>

        <button class="btn btn-ghost btn-block" id="clear-cart" style="margin-top:0.5rem;color:var(--error);">
          🗑️ Vider le panier
        </button>
      </aside>
    </div>
  `;

  bindCartEvents();
}

/* ============================================================
   RENDU D'UN ARTICLE
   ============================================================ */
function renderItem(item) {
  const p = item.products;
  const img = p.product_images?.find(i => i.is_primary)?.image_url
    || p.product_images?.[0]?.image_url
    || 'https://via.placeholder.com/120?text=?';

  // Trouver la variante si applicable
  const variant = item.variant_id
    ? p.product_variants?.find(v => v.id === item.variant_id)
    : null;

  const price = getItemPrice(item);
  const stock = variant ? variant.stock : p.stock;
  const maxQty = Math.min(stock, 99);

  // Alerte stock
  let stockAlert = '';
  if (stock === 0) {
    stockAlert = `<div class="cart-stock-alert out">Rupture de stock — retirez cet article</div>`;
  } else if (item.quantity > stock) {
    stockAlert = `<div class="cart-stock-alert out">Stock insuffisant (${stock} disponible${stock > 1 ? 's' : ''})</div>`;
  } else if (stock < 10) {
    stockAlert = `<div class="cart-stock-alert low">Plus que ${stock} en stock</div>`;
  }

  const variantHtml = variant
    ? `<div class="cart-variant">${[variant.size, variant.color].filter(Boolean).join(' · ')}</div>`
    : '';

  return `
    <div class="cart-item" data-item-id="${item.id}">
      <a href="product.html?id=${p.id}" class="cart-item-image">
        <img src="${img}" alt="${p.name}">
      </a>

      <div class="cart-item-info">
        <a href="product.html?id=${p.id}" class="cart-item-name">${p.name}</a>
        ${variantHtml}
        <div class="cart-item-price">${formatPrice(price)}</div>
        ${stockAlert}
      </div>

      <div class="cart-item-actions">
        <div class="quantity-selector">
          <button data-action="decrease" data-item="${item.id}">−</button>
          <input type="number" value="${item.quantity}" min="1" max="${maxQty}" data-item="${item.id}" readonly>
          <button data-action="increase" data-item="${item.id}">+</button>
        </div>
        <div class="cart-item-total">${formatPrice(price * item.quantity)}</div>
        <button class="cart-item-remove" data-action="remove" data-item="${item.id}" title="Retirer">
          🗑️
        </button>
      </div>
    </div>
  `;
}

/* ============================================================
   PRIX D'UN ARTICLE (variante prioritaire)
   ============================================================ */
function getItemPrice(item) {
  const variant = item.variant_id
    ? item.products.product_variants?.find(v => v.id === item.variant_id)
    : null;
  return Number(variant?.price || item.products.price);
}

/* ============================================================
   BIND DES ÉVÉNEMENTS
   ============================================================ */
function bindCartEvents() {
  // Boutons +/−
  document.querySelectorAll('button[data-action="increase"], button[data-action="decrease"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.item;
      const delta = btn.dataset.action === 'increase' ? 1 : -1;
      changeQuantity(itemId, delta);
    });
  });

  // Suppression
  document.querySelectorAll('button[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.item));
  });

  // Vider
  document.getElementById('clear-cart')?.addEventListener('click', clearCart);
}

/* ============================================================
   MODIFIER LA QUANTITÉ
   ============================================================ */
async function changeQuantity(itemId, delta) {
  const item = cartData.items.find(i => String(i.id) === String(itemId));
  if (!item) return;

  const p = item.products;
  const variant = item.variant_id
    ? p.product_variants?.find(v => v.id === item.variant_id)
    : null;
  const stock = variant ? variant.stock : p.stock;

  const newQty = item.quantity + delta;

  if (newQty < 1) {
    removeItem(itemId);
    return;
  }

  if (newQty > stock) {
    alert(`Stock maximum atteint (${stock} disponible${stock > 1 ? 's' : ''}).`);
    return;
  }

  // Update optimiste (UI immédiate)
  item.quantity = newQty;
  const itemEl = document.querySelector(`.cart-item[data-item-id="${itemId}"]`);
  if (itemEl) {
    itemEl.querySelector('input[type="number"]').value = newQty;
    const price = getItemPrice(item);
    itemEl.querySelector('.cart-item-total').textContent = formatPrice(price * newQty);
  }

  // Mettre à jour les totaux
  updateTotals();

  // Mettre à jour en BDD
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity: newQty })
    .eq('id', itemId);

  if (error) {
    console.error(error);
    alert('Erreur de mise à jour : ' + error.message);
    await loadCart();
  }
}

/* ============================================================
   RECALCUL DES TOTAUX
   ============================================================ */
function updateTotals() {
  const items = cartData.items.filter(i => i.products && i.products.is_active);
  const subtotal = items.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : (subtotal > 0 ? SHIPPING_FEE : 0);
  const total = subtotal + shipping;

  const summary = document.querySelector('.cart-summary');
  if (!summary) return;

  const subtotalEl = summary.querySelector('.summary-line:nth-of-type(1) span:last-child');
  const shippingEl = summary.querySelector('.summary-line:nth-of-type(2) span:last-child');
  const totalEl = summary.querySelector('.summary-total span:last-child');

  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (shippingEl) {
    shippingEl.innerHTML = shipping === 0
      ? '<strong style="color:var(--success);">Gratuite</strong>'
      : formatPrice(shipping);
  }
  if (totalEl) totalEl.textContent = formatPrice(total);
}

/* ============================================================
   SUPPRIMER UN ARTICLE
   ============================================================ */
async function removeItem(itemId) {
  if (!confirm('Retirer cet article du panier ?')) return;

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  await loadCart();
}

/* ============================================================
   VIDER LE PANIER
   ============================================================ */
async function clearCart() {
  if (!confirm('Vider complètement votre panier ?')) return;

  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', cartData.cartId);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  await loadCart();
}

/* ============================================================
   ERREUR
   ============================================================ */
function renderError(msg) {
  document.getElementById('cart-container').innerHTML = `
    <div style="text-align:center;padding:3rem;color:var(--error);">
      <p>${msg}</p>
      <a href="products.html" class="btn btn-primary" style="margin-top:1rem;">Retour aux produits</a>
    </div>
  `;
}

/* ============================================================
   UTILITAIRE
   ============================================================ */
function formatPrice(n) {
  return Number(n || 0).toFixed(2) + ' €';
}