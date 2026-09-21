// js/categories.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

/* ============================================================
   CHARGEMENT DES CATÉGORIES
   ============================================================ */
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, slug, products(id)')
    .order('name');

  if (error) {
    console.error(error);
    grid.innerHTML = '<p class="error">Erreur de chargement.</p>';
    return;
  }

  if (!categories || categories.length === 0) {
    grid.innerHTML = '<p class="empty">Aucune catégorie disponible.</p>';
    return;
  }

  grid.innerHTML = categories.map(cat => {
    const count = cat.products?.length || 0;
    return `
      <a href="products.html?category=${cat.id}" class="category-card">
        <span class="category-count">${count} produit${count > 1 ? 's' : ''}</span>
        <div class="category-card-content">
          <h3>${cat.name}</h3>
          <p>Découvrir la catégorie</p>
        </div>
      </a>
    `;
  }).join('');
}

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();       // 🎨 Navbar
  loadCategories();   // 📦 Catégories
});