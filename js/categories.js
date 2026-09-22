// js/categories.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

const CATEGORY_ICONS = {
  'electronique': 'smartphone',
  'vetements': 'shirt',
  'maison-deco': 'home',
  'sport-loisirs': 'dumbbell',
  'beaute-sante': 'sparkles',
  'default': 'package'
};

const CATEGORY_COLORS = [
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', accent: '#764ba2' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', accent: '#f5576c' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', accent: '#00f2fe' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', accent: '#38f9d7' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', accent: '#fa709a' },
  { bg: 'linear-gradient(135deg, #ff8c00 0%, #e67e00 100%)', accent: '#ff8c00' },
  { bg: 'linear-gradient(135deg, #0f1e3d 0%, #1a2f57 100%)', accent: '#1a2f57' },
  { bg: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', accent: '#30cfd0' }
];

let state = {
  categories: [],
  sort: 'name'
};

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  await loadCategories();
  await loadStats();
  render();
  bindEvents();
});

/* ============================================================
   CHARGEMENT
   ============================================================ */
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, created_at, products(id, is_active)')
    .order('name');

  if (error) {
    console.error(error);
    state.categories = [];
    return;
  }

  // Filtrer les produits actifs pour le compteur
  state.categories = (data || []).map(cat => ({
    ...cat,
    productCount: (cat.products || []).filter(p => p.is_active).length
  }));
}

async function loadStats() {
  // Compteur catégories
  const catCount = state.categories.length;
  document.getElementById('stat-categories-count').textContent = catCount;

  // Compteur produits actifs
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  document.getElementById('stat-products-count').textContent = count || 0;
}

/* ============================================================
   RENDU
   ============================================================ */
function render() {
  const grid = document.getElementById('categories-grid');
  const label = document.getElementById('categories-count-label');

  if (!state.categories.length) {
    label.textContent = '';
    grid.innerHTML = `
      <div class="categories-empty">
        <div class="categories-empty-icon">
          <i data-lucide="folder-open"></i>
        </div>
        <h3>Aucune catégorie disponible</h3>
        <p>Les catégories apparaîtront ici dès qu'elles seront créées.</p>
        <a href="products.html" class="btn btn-primary">Voir tous les produits</a>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Trier
  let sorted = [...state.categories];
  if (state.sort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.sort === 'popular') {
    sorted.sort((a, b) => b.productCount - a.productCount);
  } else if (state.sort === 'recent') {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  label.textContent = `${sorted.length} catégorie${sorted.length > 1 ? 's' : ''}`;

  grid.innerHTML = sorted.map((cat, index) => {
    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    const icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS['default'];
    const countLabel = cat.productCount > 0
      ? `${cat.productCount} produit${cat.productCount > 1 ? 's' : ''}`
      : 'Bientôt disponible';

    return `
      <a href="products.html?category=${cat.id}" class="category-tile">
        <div class="category-tile-bg" style="background:${color.bg};">
          <div class="category-tile-pattern"></div>
          <div class="category-tile-icon">
            <i data-lucide="${icon}"></i>
          </div>
        </div>
        <div class="category-tile-body">
          <h3>${cat.name}</h3>
          <span class="category-tile-count">
            <i data-lucide="package" style="width:13px;height:13px;"></i>
            ${countLabel}
          </span>
          <span class="category-tile-arrow">
            <i data-lucide="arrow-right"></i>
          </span>
        </div>
      </a>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  document.getElementById('sort-categories')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });
}