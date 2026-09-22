// js/product-detail.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';   // ✅ AJOUT


const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

const container = document.getElementById('product-detail');
let currentProduct = null;
let selectedVariant = null;
let isFavorite = false;
let quantity = 1;

/* ============================================================
   CHARGEMENT DU PRODUIT
   ============================================================ */
async function loadProduct() {
  if (!productId) {
    container.innerHTML = '<p class="error">Produit introuvable.</p>';
    return;
  }

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      categories(id, name, slug),
      product_images(id, image_url, is_primary),
      product_variants(id, size, color, price, stock, sku)
    `)
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    container.innerHTML = '<p class="error">Produit introuvable ou inactif.</p>';
    return;
  }

  currentProduct = product;

  // Charger la note moyenne
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('is_approved', true);

  const avgRating = reviews && reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const { data: { user } } = await supabase.auth.getUser();

if (user) {
  const { data: wishItem } = await supabase
    .from('wishlists')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();
  
  isFavorite = !!wishItem;
}

  renderProduct(product, avgRating, reviews?.length || 0);
  loadReviews();
}

/* ============================================================
   RENDU DU PRODUIT
   ============================================================ */
function renderProduct(product, avgRating, reviewCount) {
  const images = product.product_images?.length
    ? product.product_images.sort((a, b) => b.is_primary - a.is_primary)
    : [{ image_url: 'https://via.placeholder.com/600x600?text=AuriShop', is_primary: true }];

  const mainImg = images[0].image_url;
  const hasVariants = product.product_variants && product.product_variants.length > 0;

  // Stock total (variantes ou produit)
  const totalStock = hasVariants
    ? product.product_variants.reduce((s, v) => s + v.stock, 0)
    : product.stock;

  // Prix (variante ou produit)
  const basePrice = product.price;
  const oldPrice = product.old_price;
  const discount = oldPrice ? Math.round((1 - basePrice / oldPrice) * 100) : 0;

  // Stock alert
  let stockAlert = '';
  if (totalStock === 0) {
    stockAlert = '<div class="stock-alert out-of-stock">Rupture de stock</div>';
  } else if (totalStock < 10) {
    stockAlert = `<div class="stock-alert low-stock">Plus que ${totalStock} en stock — commandez vite !</div>`;
  } else {
    stockAlert = '<div class="stock-alert in-stock">En stock — expédition sous 24h</div>';
  }

  // Tri des variantes par taille puis couleur
  const sizes = hasVariants ? [...new Set(product.product_variants.map(v => v.size).filter(Boolean))] : [];
  const colors = hasVariants ? [...new Set(product.product_variants.map(v => v.color).filter(Boolean))] : [];

  // Étoiles
  const starsHtml = avgRating
    ? `<span class="stars">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5 - Math.round(avgRating))}</span>
       <span>${avgRating}/5 (${reviewCount} avis)</span>`
    : '<span style="color:var(--gris-texte);">Aucun avis pour le moment</span>';

  container.innerHTML = `
    <nav class="breadcrumb">
      <a href="index.html">Accueil</a> ›
      <a href="products.html">Produits</a> ›
      ${product.categories ? `<a href="products.html?category=${product.categories.id}">${product.categories.name}</a> ›` : ''}
      <span>${product.name}</span>
    </nav>

    <div class="detail-grid">
      <!-- GALERIE -->
      <div class="gallery">
        <div class="gallery-main">
          <img src="${mainImg}" alt="${product.name}" id="main-image">
        </div>
        ${images.length > 1 ? `
          <div class="gallery-thumbs">
            ${images.map((img, i) => `
              <img src="${img.image_url}" alt="${product.name} - ${i + 1}" class="${i === 0 ? 'active' : ''}" data-src="${img.image_url}">
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- INFOS -->
      <div class="detail-info">
        <h1>${product.name}</h1>
        ${product.brand ? `<p class="detail-brand">Marque : <strong>${product.brand}</strong></p>` : ''}
        <div class="detail-rating">${starsHtml}</div>

        <div class="detail-price">
          <span class="price">${Number(basePrice).toFixed(2)} €</span>
          ${oldPrice ? `<span class="old-price">${Number(oldPrice).toFixed(2)} €</span>` : ''}
          ${discount > 0 ? `<span class="discount">-${discount}%</span>` : ''}
        </div>

        ${stockAlert}

        ${product.description ? `<p class="detail-description">${product.description}</p>` : ''}

        ${sizes.length > 0 ? `
          <div class="variants-section">
            <h4>Taille</h4>
            <div class="variant-options" id="size-options">
              ${sizes.map(s => `<button class="variant-option" data-size="${s}">${s}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        ${colors.length > 0 ? `
          <div class="variants-section">
            <h4>Couleur</h4>
            <div class="variant-options" id="color-options">
              ${colors.map(c => `<button class="variant-option" data-color="${c}">${c}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="purchase-row">
          <div class="quantity-selector">
            <button id="qty-minus">−</button>
            <input type="number" id="qty-input" value="1" min="1" max="${totalStock || 1}">
            <button id="qty-plus">+</button>
          </div>
          <button class="btn btn-primary" id="add-to-cart" ${totalStock === 0 ? 'disabled' : ''}>
            ${totalStock === 0 ? 'Indisponible' : 'Ajouter au panier'}
          </button>
        </div>

        <div class="detail-actions">
            <button class="btn btn-outline" id="add-to-wishlist">
                ${isFavorite ? '♥ Retirer des favoris' : '♡ Ajouter aux favoris'}
            </button>
        </div>
      </div>
    </div>

    <!-- ONGLETS -->
    <div class="tabs">
      <div class="tabs-nav">
        <button class="tab-btn active" data-tab="description">Description</button>
        <button class="tab-btn" data-tab="reviews">Avis (${reviewCount})</button>
      </div>

      <div class="tab-content active" id="tab-description">
        <p style="line-height:1.8;color:var(--gris-texte);">
          ${product.description || 'Aucune description disponible pour ce produit.'}
        </p>
      </div>

      <div class="tab-content" id="tab-reviews">
        <div class="reviews-list" id="reviews-list"></div>
        <div class="review-form" id="review-form-container" style="display:none;">
          <h3>Laisser un avis</h3>
          <div class="star-rating-input" id="star-input">
            <span data-value="1">★</span>
            <span data-value="2">★</span>
            <span data-value="3">★</span>
            <span data-value="4">★</span>
            <span data-value="5">★</span>
          </div>
          <textarea id="review-comment" placeholder="Partagez votre expérience..."></textarea>
          <button class="btn btn-primary" id="submit-review">Publier mon avis</button>
        </div>
      </div>
    </div>
  `;

  // Événements galerie
  container.querySelectorAll('.gallery-thumbs img').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.getElementById('main-image').src = thumb.dataset.src;
      container.querySelectorAll('.gallery-thumbs img').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  // Événements variantes
  let selectedSize = sizes.length === 1 ? sizes[0] : null;
  let selectedColor = colors.length === 1 ? colors[0] : null;

  function updateVariant() {
    if (hasVariants) {
      selectedVariant = product.product_variants.find(v =>
        (!selectedSize || v.size === selectedSize) &&
        (!selectedColor || v.color === selectedColor)
      );
      // Mise à jour prix/stock si variante
      if (selectedVariant) {
        if (selectedVariant.price) {
          document.querySelector('.detail-price .price').textContent = `${Number(selectedVariant.price).toFixed(2)} €`;
        }
        const qtyInput = document.getElementById('qty-input');
        qtyInput.max = selectedVariant.stock;
        if (parseInt(qtyInput.value) > selectedVariant.stock) qtyInput.value = selectedVariant.stock;
        document.getElementById('add-to-cart').disabled = selectedVariant.stock === 0;
      }
    }
  }

  container.querySelectorAll('#size-options .variant-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSize = btn.dataset.size;
      container.querySelectorAll('#size-options .variant-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateVariant();
    });
  });

  container.querySelectorAll('#color-options .variant-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color;
      container.querySelectorAll('#color-options .variant-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateVariant();
    });
  });

  // Pré-sélection si une seule option
  if (sizes.length === 1) container.querySelector('#size-options .variant-option')?.classList.add('active');
  if (colors.length === 1) container.querySelector('#color-options .variant-option')?.classList.add('active');
  updateVariant();

  // Quantité
  const qtyInput = document.getElementById('qty-input');
  document.getElementById('qty-minus').addEventListener('click', () => {
    if (parseInt(qtyInput.value) > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    if (parseInt(qtyInput.value) < parseInt(qtyInput.max)) qtyInput.value = parseInt(qtyInput.value) + 1;
  });

  // Ajouter au panier
  document.getElementById('add-to-cart').addEventListener('click', addToCart);

  // Ajouter aux favoris
  document.getElementById('add-to-wishlist').addEventListener('click', addToWishlist);

  // Onglets
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Étoiles du formulaire d'avis
  initStarInput();
}

/* ============================================================
   AJOUT AU PANIER
   ============================================================ */
async function addToCart() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const qty = parseInt(document.getElementById('qty-input').value);
  if (currentProduct.product_variants?.length && !selectedVariant) {
    alert('Veuillez sélectionner une variante.');
    return;
  }

  const btn = document.getElementById('add-to-cart');
  btn.disabled = true;
  btn.textContent = 'Ajout...';

  // Récupérer ou créer le panier
  let { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!cart) {
    const { data: newCart, error } = await supabase
      .from('carts')
      .insert({ user_id: user.id })
      .select('id')
      .single();
    if (error) {
      alert('Erreur : ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Ajouter au panier';
      return;
    }
    cart = newCart;
  }

  // Vérifier si l'article existe déjà
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', currentProduct.id)
    .is('variant_id', selectedVariant?.id || null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + qty })
      .eq('id', existing.id);
    if (error) alert('Erreur : ' + error.message);
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: currentProduct.id,
        variant_id: selectedVariant?.id || null,
        quantity: qty
      });
    if (error) alert('Erreur : ' + error.message);
  }

  btn.textContent = '✓ Ajouté !';
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Ajouter au panier';
  }, 1500);
}

/* ============================================================
   AJOUT AUX FAVORIS
   ============================================================ */
async function addToWishlist() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const btn = document.getElementById('add-to-wishlist');
  const isActive = btn.textContent.includes('Retirer');

  if (isActive) {
    // Retirer
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', currentProduct.id);

    if (!error) {
      btn.textContent = '♡ Ajouter aux favoris';
      window.dispatchEvent(new CustomEvent('wishlist-updated'));
      showToast('Retiré des favoris');
    }
  } else {
    // Ajouter
    const { error } = await supabase
      .from('wishlists')
      .insert({ user_id: user.id, product_id: currentProduct.id });

    if (error && error.code === '23505') {
      // Déjà présent (ne devrait pas arriver avec le check)
      btn.textContent = '♥ Retirer des favoris';
    } else if (!error) {
      btn.textContent = '♥ Retirer des favoris';
      window.dispatchEvent(new CustomEvent('wishlist-updated'));
      showToast('Ajouté aux favoris ❤️');
    }
  }
}

/* ============================================================
   AVIS
   ============================================================ */
async function loadReviews() {
  const list = document.getElementById('reviews-list');
  if (!list) return;

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, user_id, profiles(first_name, last_name)')
    .eq('product_id', productId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  if (error || !reviews || reviews.length === 0) {
    list.innerHTML = '<p style="color:var(--gris-texte);text-align:center;padding:2rem;">Aucun avis pour le moment. Soyez le premier !</p>';
  } else {
    list.innerHTML = reviews.map(r => {
      const name = r.profiles
        ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || 'Client'
        : 'Client';
      return `
        <div class="review-item">
          <div class="review-header">
            <span class="review-author">${name}</span>
            <span class="review-date">${new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          ${r.comment ? `<p class="review-comment">${r.comment}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  // Vérifier si l'utilisateur peut laisser un avis
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();

  if (!existing) {
    document.getElementById('review-form-container').style.display = 'block';
    document.getElementById('submit-review').addEventListener('click', submitReview);
  } else {
    // Déjà laissé un avis
    const form = document.getElementById('review-form-container');
    form.style.display = 'block';
    form.innerHTML = '<p style="color:var(--gris-texte);">Vous avez déjà laissé un avis sur ce produit.</p>';
  }
}

let selectedRating = 0;
function initStarInput() {
  const stars = document.querySelectorAll('#star-input span');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value);
      stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating);
      });
    });
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.value);
      stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= val));
    });
  });
  document.getElementById('star-input')?.addEventListener('mouseleave', () => {
    stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating));
  });
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

async function submitReview() {
  if (selectedRating === 0) {
    alert('Veuillez sélectionner une note.');
    return;
  }

  const form = document.getElementById('review-form-container');
  const submitButton = document.getElementById('submit-review');
  const commentInput = document.getElementById('review-comment');
  if (!form || !submitButton || !commentInput) return;

  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) {
    alert('Votre session a expiré. Veuillez vous reconnecter pour publier un avis.');
    window.location.href = 'login.html';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Publication...';

  const comment = document.getElementById('review-comment').value.trim();

  try {
    const { error } = await supabase.from('reviews').insert({
      user_id: user.id,
      product_id: productId,
      rating: selectedRating,
      comment: comment || null,
      is_approved: true
    });

    if (error) {
      console.error('Erreur enregistrement avis:', error);
      alert(`Impossible d'enregistrer votre avis : ${error.message}`);
      submitButton.disabled = false;
      submitButton.textContent = 'Publier mon avis';
      return;
    }

    alert('Merci ! Votre avis a été publié.');
    form.innerHTML = '<p style="color:var(--success);">Merci pour votre avis !</p>';
  } catch (error) {
    console.error('Erreur inattendue enregistrement avis:', error);
    alert(`Impossible d'enregistrer votre avis : ${error.message}`);
    submitButton.disabled = false;
    submitButton.textContent = 'Publier mon avis';
  }
}

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();    // ✅ AJOUT
  loadProduct();
});