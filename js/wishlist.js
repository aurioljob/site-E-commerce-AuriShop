// js/wishlist.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

let state = {
  user: null,
  items: []
};

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
  state.user = user;

  await loadWishlist();
  render();
});

/* ============================================================
   CAS : NON CONNECTÉ
   ============================================================ */
function renderNotLoggedIn() {
  document.getElementById('wishlist-subtitle').textContent = '';
  document.getElementById('wishlist-container').innerHTML = `
    <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);">
      <div style="font-size:3rem;margin-bottom:1rem;">🔒</div>
      <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Connectez-vous pour voir vos favoris</h3>
      <p style="color:var(--gris-texte);margin-bottom:1.5rem;">Votre liste de souhaits est liée à votre compte.</p>
      <a href="login.html" class="btn btn-primary">Se connecter</a>
      <a href="products.html" class="btn btn-outline" style="margin-left:0.5rem;">Continuer mes achats</a>
    </div>
  `;
}

/* ============================================================
   CHARGEMENT
   ============================================================ */
async function loadWishlist() {
  const { data, error } = await supabase
    .from('wishlists')
    .select(`
      id, created_at,
      product_id,
      products(
        id, name, slug, price, old_price, stock, is_active,
        product_images(image_url, is_primary),
        categories(name)
      )
    `)
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    state.items = [];
    return;
  }

  // Filtrer les produits supprimés ou inactifs
  state.items = (data || []).filter(i => i.products && i.products.is_active);
}

/* ============================================================
   RENDU PRINCIPAL
   ============================================================ */
function render() {
  const container = document.getElementById('wishlist-container');
  const subtitle = document.getElementById('wishlist-subtitle');

  if (state.items.length === 0) {
    subtitle.textContent = '';
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 1rem;background:var(--blanc);border-radius:var(--radius-lg);border:1px solid var(--gris);">
        <div style="font-size:3rem;margin-bottom:1rem;">❤️</div>
        <h3 style="color:var(--bleu-nuit);margin-bottom:0.5rem;">Votre liste de favoris est vide</h3>
        <p style="color:var(--gris-texte);margin-bottom:1.5rem;">Ajoutez des produits en cliquant sur le ♡</p>
        <a href="products.html" class="btn btn-primary">Découvrir les produits</a>
      </div>
    `;
    return;
  }

  subtitle.textContent = `${state.items.length} produit${state.items.length > 1 ? 's' : ''} dans vos favoris`;

  container.innerHTML = `
    <div class="wishlist-header-actions">
      <button class="btn btn-ghost" id="add-all-to-cart">
        🛒 Tout ajouter au panier
      </button>
      <button class="btn btn-ghost" id="clear-wishlist" style="color:var(--error);">
        🗑️ Vider la liste
      </button>
    </div>

    <div class="products-grid">
      ${state.items.map(item => renderCard(item)).join('')}
    </div>
  `;

  bindEvents();
}

/* ============================================================
   RENDU D'UNE CARTE
   ============================================================ */
function renderCard(item) {
  const p = item.products;
  const img = p.product_images?.find(i => i.is_primary)?.image_url
    || p.product_images?.[0]?.image_url
    || 'https://via.placeholder.com/300?text=AuriShop';

  const oldPriceHtml = p.old_price
    ? `<span class="old-price">${formatPrice(p.old_price)}</span>`
    : '';

  const discount = p.old_price
    ? Math.round((1 - p.price / p.old_price) * 100)
    : 0;

  const outOfStock = p.stock === 0;

  return `
    <div class="product-card" data-product-id="${p.id}">
      ${discount > 0 ? `<span class="product-badge">-${discount}%</span>` : ''}
      
      <button class="wishlist-btn active" 
              data-product-id="${p.id}" 
              title="Retirer des favoris">
        ♥
      </button>

      <a href="product.html?id=${p.id}">
        <div class="product-image">
          <img src="${img}" alt="${p.name}" loading="lazy">
        </div>
      </a>

      <div class="product-info">
        <a href="product.html?id=${p.id}">
          <h3>${p.name}</h3>
        </a>
        <div class="product-price">
          <span class="price">${formatPrice(p.price)}</span>
          ${oldPriceHtml}
        </div>
        ${outOfStock
          ? '<p class="product-stock out">Rupture de stock</p>'
          : (p.stock < 10 ? `<p class="product-stock low">Plus que ${p.stock} en stock</p>` : '')
        }
        
        <button class="btn btn-primary btn-block add-to-cart-btn" 
                data-product-id="${p.id}" 
                ${outOfStock ? 'disabled' : ''}
                style="margin-top:0.75rem;">
          ${outOfStock ? 'Indisponible' : 'Ajouter au panier'}
        </button>
      </div>
    </div>
  `;
}

/* ============================================================
   BIND DES ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  // Retirer des favoris
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeFromWishlist(btn.dataset.productId);
    });
  });

  // Ajouter au panier
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      addToCart(btn.dataset.productId);
    });
  });

  // Tout ajouter au panier
  document.getElementById('add-all-to-cart')?.addEventListener('click', addAllToCart);

  // Vider la wishlist
  document.getElementById('clear-wishlist')?.addEventListener('click', clearWishlist);
}

/* ============================================================
   RETIRER UN PRODUIT
   ============================================================ */
async function removeFromWishlist(productId) {
  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('user_id', state.user.id)
    .eq('product_id', productId);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  // Retirer visuellement la carte avec animation
  const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
  if (card) {
    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    setTimeout(() => {
      state.items = state.items.filter(i => i.product_id !== productId);
      if (state.items.length === 0) {
        render();
      } else {
        card.remove();
        document.getElementById('wishlist-subtitle').textContent =
          `${state.items.length} produit${state.items.length > 1 ? 's' : ''} dans vos favoris`;
      }
    }, 300);
  } else {
    await loadWishlist();
    render();
  }

  updateNavbarWishlistBadge();
  showToast('Retiré des favoris', 'success');
}

/* ============================================================
   AJOUTER AU PANIER
   ============================================================ */
async function addToCart(productId) {
  const product = state.items.find(i => i.product_id === productId)?.products;
  if (!product) return;

  if (product.stock === 0) {
    alert('Ce produit est en rupture de stock.');
    return;
  }

  // Récupérer ou créer le panier
  let { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', state.user.id)
    .maybeSingle();

  if (!cart) {
    const { data: newCart, error } = await supabase
      .from('carts')
      .insert({ user_id: state.user.id })
      .select('id')
      .single();
    if (error) { alert('Erreur : ' + error.message); return; }
    cart = newCart;
  }

  // Vérifier si déjà dans le panier
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', productId)
    .is('variant_id', null)
    .maybeSingle();

  if (existing) {
    const newQty = Math.min(existing.quantity + 1, product.stock);
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: newQty })
      .eq('id', existing.id);
    if (error) { alert('Erreur : ' + error.message); return; }
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: productId,
        variant_id: null,
        quantity: 1
      });
    if (error) { alert('Erreur : ' + error.message); return; }
  }

  showToast('Ajouté au panier 🛒', 'success');
}

/* ============================================================
   TOUT AJOUTER AU PANIER
   ============================================================ */
async function addAllToCart() {
  const availableItems = state.items.filter(i => i.products.stock > 0);
  if (availableItems.length === 0) {
    alert('Aucun produit disponible en stock.');
    return;
  }

  if (!confirm(`Ajouter ${availableItems.length} produit(s) au panier ?`)) return;

  const btn = document.getElementById('add-all-to-cart');
  btn.disabled = true;
  btn.textContent = 'Ajout en cours...';

  // Récupérer ou créer le panier
  let { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', state.user.id)
    .maybeSingle();

  if (!cart) {
    const { data: newCart } = await supabase
      .from('carts')
      .insert({ user_id: state.user.id })
      .select('id')
      .single();
    cart = newCart;
  }

  let successCount = 0;

  for (const item of availableItems) {
    const p = item.products;
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', p.id)
      .is('variant_id', null)
      .maybeSingle();

    if (existing) {
      const newQty = Math.min(existing.quantity + 1, p.stock);
      await supabase.from('cart_items').update({ quantity: newQty }).eq('id', existing.id);
    } else {
      await supabase.from('cart_items').insert({
        cart_id: cart.id,
        product_id: p.id,
        variant_id: null,
        quantity: 1
      });
    }
    successCount++;
  }

  showToast(`${successCount} produit(s) ajouté(s) au panier 🛒`, 'success');

  btn.disabled = false;
  btn.textContent = '🛒 Tout ajouter au panier';
}

/* ============================================================
   VIDER LA WISHLIST
   ============================================================ */
async function clearWishlist() {
  if (!confirm('Vider complètement votre liste de favoris ?')) return;

  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('user_id', state.user.id);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  state.items = [];
  render();
  updateNavbarWishlistBadge();
  showToast('Liste vidée', 'success');
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
function formatPrice(n) {
  return Number(n || 0).toFixed(2) + ' €';
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function updateNavbarWishlistBadge() {
  // Déclenche un événement que la navbar peut écouter
  window.dispatchEvent(new CustomEvent('wishlist-updated'));
}