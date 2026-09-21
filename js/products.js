// js/products.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';   // ✅ AJOUT

const params = new URLSearchParams(window.location.search);
/* ============================================================
   ÉTAT GLOBAL
   ============================================================ */
const state = {
  page: 1,
  perPage: 12,
  total: 0,
  filters: {
    search: '',
    category: '',
    brand: '',
    minPrice: '',
    maxPrice: '',
    inStock: false,
    sort: 'created_at'
  }
};

const productsGrid = document.getElementById('products-grid');
const paginationEl = document.getElementById('pagination');
const resultsCountEl = document.getElementById('results-count');
const categoriesListEl = document.getElementById('categories-list');
const activeFiltersEl = document.getElementById('active-filters');

/* ============================================================
   CHARGEMENT DES CATÉGORIES (sidebar)
   ============================================================ */
async function loadCategoriesSidebar() {
  if (!categoriesListEl) return;

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('name');

  if (error || !data) return;

  categoriesListEl.innerHTML = `
    <li>
      <a href="#" data-category="" class="${!state.filters.category ? 'active' : ''}">
        <span>Toutes les catégories</span>
      </a>
    </li>
  ` + data.map(cat => `
    <li>
      <a href="#" data-category="${cat.id}" class="${state.filters.category == cat.id ? 'active' : ''}">
        <span>${cat.name}</span>
      </a>
    </li>
  `).join('');

  // Événement clic
  categoriesListEl.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters.category = link.dataset.category;
      state.page = 1;
      loadCategoriesSidebar();
      loadProducts();
    });
  });
}

/* ============================================================
   CHARGEMENT DES PRODUITS
   ============================================================ */
async function loadProducts() {
  // Skeleton
  productsGrid.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');

  let query = supabase
    .from('products')
    .select(`
      id, name, slug, price, old_price, stock, brand, created_at,
      product_images(image_url, is_primary),
      categories(name)
    `, { count: 'exact' })
    .eq('is_active', true);

  // Recherche
  if (state.filters.search) {
    query = query.or(`name.ilike.%${state.filters.search}%,description.ilike.%${state.filters.search}%`);
  }

  // Catégorie
  if (state.filters.category) {
    query = query.eq('category_id', state.filters.category);
  }

  // Marque
  if (state.filters.brand) {
    query = query.ilike('brand', `%${state.filters.brand}%`);
  }

  // Prix
  if (state.filters.minPrice) {
    query = query.gte('price', state.filters.minPrice);
  }
  if (state.filters.maxPrice) {
    query = query.lte('price', state.filters.maxPrice);
  }

  // Stock
  if (state.filters.inStock) {
    query = query.gt('stock', 0);
  }

  // Tri
  const sortMap = {
    'created_at': ['created_at', { ascending: false }],
    'price_asc': ['price', { ascending: true }],
    'price_desc': ['price', { ascending: false }],
    'name': ['name', { ascending: true }],
    'popular': ['created_at', { ascending: false }]
  };
  const [field, opts] = sortMap[state.filters.sort] || sortMap['created_at'];
  query = query.order(field, opts);

  // Pagination
  const from = (state.page - 1) * state.perPage;
  const to = from + state.perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Erreur chargement produits :', error);
    productsGrid.innerHTML = `<p class="error">Erreur de chargement. Réessayez.</p>`;
    return;
  }

  state.total = count || 0;

  // 🆕 Récupérer les favoris de l'utilisateur
  const { data: { user } } = await supabase.auth.getUser();
  let favoriteIds = new Set();
  
  if (user) {
    const { data: wishlist } = await supabase
      .from('wishlists')
      .select('product_id')
      .eq('user_id', user.id);
    
    if (wishlist) {
      favoriteIds = new Set(wishlist.map(w => w.product_id));
    }
  }

  // Mise à jour compteur
  if (resultsCountEl) {
    resultsCountEl.textContent = `${state.total} produit${state.total > 1 ? 's' : ''} trouvé${state.total > 1 ? 's' : ''}`;
  }

  renderProducts(data, favoriteIds);
  renderPagination();
  renderActiveFilters();
}

/* ============================================================
   RENDU DES PRODUITS
   ============================================================ */
function renderProducts(products, favoriteIds = new Set()) {
  if (!products || products.length === 0) {
    productsGrid.innerHTML = `
      <div class="no-results" style="grid-column:1/-1;">
        <h3>Aucun produit trouvé</h3>
        <p>Essayez de modifier vos filtres ou votre recherche.</p>
        <button class="btn btn-primary" onclick="window.resetFilters()">Réinitialiser les filtres</button>
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = products.map(product => {
    const img = product.product_images?.find(i => i.is_primary)?.image_url
      || product.product_images?.[0]?.image_url
      || 'https://via.placeholder.com/300x300?text=AuriShop';

    const oldPriceHtml = product.old_price
      ? `<span class="old-price">${Number(product.old_price).toFixed(2)} €</span>`
      : '';

    const discount = product.old_price
      ? Math.round((1 - product.price / product.old_price) * 100)
      : 0;

    // Badge
    let badge = '';
    if (product.stock === 0) {
      badge = '<span class="product-badge out">Rupture</span>';
    } else if (discount > 0) {
      badge = `<span class="product-badge">-${discount}%</span>`;
    } else {
      // Nouveau si < 7 jours
      const daysSince = (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) badge = '<span class="product-badge new">Nouveau</span>';
    }

    // Stock
    let stockHtml = '';
    if (product.stock === 0) {
      stockHtml = '<p class="product-stock out">Rupture de stock</p>';
    } else if (product.stock < 10) {
      stockHtml = `<p class="product-stock low">Plus que ${product.stock} en stock</p>`;
    }

    return `
      <div class="product-card">
        ${badge}
        <button class="wishlist-btn ${favoriteIds.has(product.id) ? 'active' : ''}"
          data-id="${product.id}"
          title="${favoriteIds.has(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
          ${favoriteIds.has(product.id) ? '♥' : '♡'}
        </button>
        <a href="product.html?id=${product.id}">
          <div class="product-image">
            <img src="${img}" alt="${product.name}" loading="lazy">
          </div>
          <div class="product-info">
            <h3>${product.name}</h3>
            ${product.brand ? `<p style="font-size:0.82rem;color:var(--gris-texte);">${product.brand}</p>` : ''}
            <div class="product-price">
              <span class="price">${Number(product.price).toFixed(2)} €</span>
              ${oldPriceHtml}
            </div>
            ${stockHtml}
          </div>
        </a>
      </div>
    `;
  }).join('');

 productsGrid.querySelectorAll('.wishlist-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    
    const productId = btn.dataset.id;
    const isActive = btn.classList.contains('active');
    
    if (isActive) {
      // Retirer
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
      
      if (!error) {
        btn.classList.remove('active');
        btn.textContent = '♡';
        btn.title = 'Ajouter aux favoris';
        window.dispatchEvent(new CustomEvent('wishlist-updated'));
      }
    } else {
      // Ajouter
      const { error } = await supabase
        .from('wishlists')
        .insert({ user_id: user.id, product_id: productId });
      
      if (!error) {
        btn.classList.add('active');
        btn.textContent = '♥';
        btn.title = 'Retirer des favoris';
        window.dispatchEvent(new CustomEvent('wishlist-updated'));
      }
    }
  });
});
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
  if (!paginationEl) return;

  const totalPages = Math.ceil(state.total / state.perPage);
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹ Précédent</button>`;

  const maxButtons = 5;
  let start = Math.max(1, state.page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

  if (start > 1) {
    html += `<button data-page="1">1</button>`;
    if (start > 2) html += `<span style="padding:0 0.5rem;">…</span>`;
  }

  for (let i = start; i <= end; i++) {
    html += `<button data-page="${i}" class="${i === state.page ? 'active' : ''}">${i}</button>`;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span style="padding:0 0.5rem;">…</span>`;
    html += `<button data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `<button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">Suivant ›</button>`;

  paginationEl.innerHTML = html;

  paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = parseInt(btn.dataset.page);
      loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ============================================================
   FILTRES ACTIFS (chips)
   ============================================================ */
function renderActiveFilters() {
  if (!activeFiltersEl) return;

  const chips = [];
  if (state.filters.search) chips.push({ label: `Recherche : "${state.filters.search}"`, key: 'search' });
  if (state.filters.brand) chips.push({ label: `Marque : ${state.filters.brand}`, key: 'brand' });
  if (state.filters.minPrice) chips.push({ label: `Min : ${state.filters.minPrice} €`, key: 'minPrice' });
  if (state.filters.maxPrice) chips.push({ label: `Max : ${state.filters.maxPrice} €`, key: 'maxPrice' });
  if (state.filters.inStock) chips.push({ label: 'En stock uniquement', key: 'inStock' });

  if (chips.length === 0) {
    activeFiltersEl.innerHTML = '';
    return;
  }

  activeFiltersEl.innerHTML = chips.map(c => `
    <span class="filter-chip">
      ${c.label}
      <button data-key="${c.key}">×</button>
    </span>
  `).join('');

  activeFiltersEl.querySelectorAll('button[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (key === 'inStock') state.filters.inStock = false;
      else state.filters[key] = '';
      state.page = 1;

      // Reset UI
      if (key === 'search' && document.getElementById('search-input')) document.getElementById('search-input').value = '';
      if (key === 'brand' && document.getElementById('brand-input')) document.getElementById('brand-input').value = '';
      if (key === 'minPrice' && document.getElementById('min-price')) document.getElementById('min-price').value = '';
      if (key === 'maxPrice' && document.getElementById('max-price')) document.getElementById('max-price').value = '';
      if (key === 'inStock' && document.getElementById('in-stock')) document.getElementById('in-stock').checked = false;

      loadCategoriesSidebar();
      loadProducts();
    });
  });
}

/* ============================================================
   ÉVÉNEMENTS FILTRES
   ============================================================ */
let searchTimeout;
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      state.page = 1;
      loadProducts();
    }, 350);
  });
}

const brandInput = document.getElementById('brand-input');
if (brandInput) {
  brandInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.brand = e.target.value.trim();
      state.page = 1;
      loadProducts();
    }, 350);
  });
}

const minPriceInput = document.getElementById('min-price');
const maxPriceInput = document.getElementById('max-price');
if (minPriceInput) {
  minPriceInput.addEventListener('input', (e) => {
    state.filters.minPrice = e.target.value;
    state.page = 1;
    loadProducts();
  });
}
if (maxPriceInput) {
  maxPriceInput.addEventListener('input', (e) => {
    state.filters.maxPrice = e.target.value;
    state.page = 1;
    loadProducts();
  });
}

const inStockInput = document.getElementById('in-stock');
if (inStockInput) {
  inStockInput.addEventListener('change', (e) => {
    state.filters.inStock = e.target.checked;
    state.page = 1;
    loadProducts();
  });
}

const sortSelect = document.getElementById('sort-select');
if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    state.page = 1;
    loadProducts();
  });
}

// Reset global (appelé depuis le bouton "Réinitialiser")
window.resetFilters = function() {
  state.filters = { search: '', category: '', brand: '', minPrice: '', maxPrice: '', inStock: false, sort: 'created_at' };
  state.page = 1;
  document.querySelectorAll('.filters-sidebar input').forEach(i => {
    if (i.type === 'checkbox') i.checked = false;
    else i.value = '';
  });
  if (sortSelect) sortSelect.value = 'created_at';
  loadCategoriesSidebar();
  loadProducts();
};

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();   // ✅ AJOUT

  // Pré-remplir la recherche depuis l'URL (?search=...)
  const params = new URLSearchParams(window.location.search);
  if (params.get('search')) {
    state.filters.search = params.get('search');
    if (searchInput) searchInput.value = state.filters.search;
  }
  if (params.get('category')) {
    state.filters.category = params.get('category');
  }

  await loadCategoriesSidebar();
  await loadProducts();
});