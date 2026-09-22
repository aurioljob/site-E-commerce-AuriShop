// js/index.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

/* ============================================================
   RECHERCHE DEPUIS LA NAVBAR
   ============================================================ */
function initSearchBar() {
  const input = document.getElementById('navbar-search-input');
  const btn = document.getElementById('navbar-search-btn');
  if (!input) return;

  const goSearch = () => {
    const q = input.value.trim();
    if (q) window.location.href = `products.html?search=${encodeURIComponent(q)}`;
  };

  btn?.addEventListener('click', goSearch);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') goSearch();
  });
}

/* ============================================================
   CATÉGORIES (top 6 avec icônes)
   ============================================================ */
const CATEGORY_ICONS = {
  'electronique': 'smartphone',
  'vetements': 'shirt',
  'maison-deco': 'home',
  'sport-loisirs': 'dumbbell',
  'beaute-sante': 'sparkles',
  'default': 'package'
};

async function loadCategories() {
  const row = document.getElementById('categories-row');
  if (!row) return;

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, products(id)')
    .order('name')
    .limit(6);

  if (error || !data) {
    row.innerHTML = '';
    return;
  }

  row.innerHTML = data.map(cat => {
    const count = cat.products?.length || 0;
    const icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS['default'];
    return `
      <a href="products.html?category=${cat.id}" class="category-card">
        <div class="category-icon">
          <i data-lucide="${icon}"></i>
        </div>
        <div class="category-info">
          <h3>${cat.name}</h3>
          <span>${count} produit${count > 1 ? 's' : ''}</span>
        </div>
      </a>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================================
   PRODUITS VEDETTES (nouveautés)
   ============================================================ */
async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-products');
  if (!grid) return;

  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, old_price, stock, product_images(image_url, is_primary)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error(error);
    grid.innerHTML = '<p class="error">Impossible de charger les produits.</p>';
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="empty">Aucun produit disponible pour le moment.</p>';
    return;
  }

  // Récupérer les favoris pour l'affichage des cœurs
  const { data: { user } } = await supabase.auth.getUser();
  let favoriteIds = new Set();
  if (user) {
    const { data: wishlist } = await supabase
      .from('wishlists')
      .select('product_id')
      .eq('user_id', user.id);
    if (wishlist) favoriteIds = new Set(wishlist.map(w => w.product_id));
  }

  grid.innerHTML = data.map(product => {
    const img = product.product_images?.find(i => i.is_primary)?.image_url
      || product.product_images?.[0]?.image_url
      || 'https://via.placeholder.com/300x300?text=AuriShop';

    const oldPriceHtml = product.old_price
      ? `<span class="old-price">${Number(product.old_price).toFixed(2)} €</span>`
      : '';

    const discount = product.old_price
      ? Math.round((1 - product.price / product.old_price) * 100)
      : 0;

    const isFav = favoriteIds.has(product.id);
    const outOfStock = product.stock === 0;

    return `
      <div class="product-card">
        ${discount > 0 ? `<span class="product-badge">-${discount}%</span>` : ''}
        ${outOfStock ? `<span class="product-badge out">Rupture</span>` : ''}
        <button class="wishlist-btn ${isFav ? 'active' : ''}" 
                data-id="${product.id}" 
                title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
          <i data-lucide="heart" style="width:16px;height:16px;${isFav ? 'fill:currentColor;' : ''}"></i>
        </button>
        <a href="product.html?id=${product.id}">
          <div class="product-image">
            <img src="${img}" alt="${product.name}" loading="lazy">
          </div>
          <div class="product-info">
            <h3>${product.name}</h3>
            <div class="product-price">
              <span class="price">${Number(product.price).toFixed(2)} €</span>
              ${oldPriceHtml}
            </div>
          </div>
        </a>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  // Bind wishlist
  grid.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = 'login.html'; return; }

      const productId = btn.dataset.id;
      const isActive = btn.classList.contains('active');

      if (isActive) {
        await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', productId);
        btn.classList.remove('active');
        btn.querySelector('i').style.fill = 'none';
      } else {
        await supabase.from('wishlists').insert({ user_id: user.id, product_id: productId });
        btn.classList.add('active');
        btn.querySelector('i').style.fill = 'currentColor';
      }
      window.dispatchEvent(new CustomEvent('wishlist-updated'));
    });
  });
}

/* ============================================================
   NEWSLETTER (fake, juste un toast)
   ============================================================ */
function initNewsletter() {
  document.getElementById('newsletter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    alert(`Merci ! ${input.value} est bien inscrit à notre newsletter.`);
    input.value = '';
  });
}

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSearchBar();
  loadCategories();
  loadFeaturedProducts();
  initNewsletter();
});