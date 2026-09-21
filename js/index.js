// js/index.js
import { supabase } from './supabase.js';
import { initNavbar } from './navbar.js';

/* ============================================================
   NAVBAR DYNAMIQUE (utilisateur connecté ou non)
   ============================================================ */
async function updateNavbar() {
  const { data: { user } } = await supabase.auth.getUser();
  const authLinks = document.getElementById('auth-links');
  const userLinks = document.getElementById('user-links');
  const userNameEl = document.getElementById('user-name');
  const adminLink = document.getElementById('admin-link');   // ✅ AJOUT

  if (user) {
    authLinks.style.display = 'none';
    userLinks.style.display = 'flex';

    // ✅ Récupérer le rôle aussi
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, role')  // ✅ AJOUT de role
      .eq('id', user.id)
      .single();

    if (profile && userNameEl) {
      userNameEl.textContent = `Bonjour, ${profile.first_name || user.email}`;
    }

    // ✅ Afficher le bouton admin si admin
    if (adminLink && profile?.role === 'admin') {
      adminLink.style.display = 'inline-flex';
    }
  } else {
    authLinks.style.display = 'flex';
    userLinks.style.display = 'none';
  }
}

/* ... le reste du fichier reste identique ... */

/* ============================================================
   DÉCONNEXION
   ============================================================ */
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });
}



/* ============================================================
   CHARGER LES PRODUITS VEDETTES (6 derniers)
   ============================================================ */
async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-products');
  if (!grid) return;

  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, old_price, product_images(image_url, is_primary)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    console.error('Erreur chargement produits :', error);
    grid.innerHTML = '<p class="error">Impossible de charger les produits.</p>';
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="empty">Aucun produit disponible pour le moment.</p>';
    return;
  }

  grid.innerHTML = data.map(product => {
    const img = product.product_images?.find(i => i.is_primary)?.image_url
      || product.product_images?.[0]?.image_url
      || 'https://via.placeholder.com/300x300?text=AuriShop';

    const oldPriceHtml = product.old_price
      ? `<span class="old-price">${Number(product.old_price).toFixed(2)} €</span>`
      : '';

    return `
      <div class="product-card">
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
}

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  loadFeaturedProducts();
});

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();
  loadFeaturedProducts();
});