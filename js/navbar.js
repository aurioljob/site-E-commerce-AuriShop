// js/navbar.js
import { supabase } from './supabase.js';

/* ============================================================
   NAVBAR UNIFIÉE POUR TOUTES LES PAGES
   ============================================================ */
export async function initNavbar() {
  const authLinks = document.getElementById('auth-links');
  const userLinks = document.getElementById('user-links');
  const userNameEl = document.getElementById('user-name');
  const adminLink = document.getElementById('admin-link');
  const logoutBtn = document.getElementById('logout-btn');

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    if (authLinks) authLinks.style.display = 'none';
    if (userLinks) userLinks.style.display = 'flex';

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, role, avatar_url')
      .eq('id', user.id)
      .single();

    if (userNameEl) {
      userNameEl.textContent = `Bonjour, ${profile?.first_name || user.email}`;
    }

    // Avatar dans la navbar
    if (profile?.avatar_url && userNameEl && !document.getElementById('nav-avatar')) {
      const avatarImg = document.createElement('img');
      avatarImg.id = 'nav-avatar';
      avatarImg.src = profile.avatar_url;
      avatarImg.alt = 'Avatar';
      avatarImg.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:0.5rem;';
      userNameEl.parentElement.insertBefore(avatarImg, userNameEl);
    }

    if (adminLink && profile?.role === 'admin') {
      adminLink.style.display = 'inline-flex';
    }

    // 🆕 Mettre à jour les badges (panier + wishlist)
    await updateBadges(user.id);

  } else {
    if (authLinks) authLinks.style.display = 'flex';
    if (userLinks) userLinks.style.display = 'none';
  }

  // Logout
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = 'true';
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  // 🆕 Écouter les mises à jour (depuis cart.js / wishlist.js)
  if (!window._wishlistListener) {
    window._wishlistListener = true;
    window.addEventListener('wishlist-updated', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await updateBadges(user.id);
    });
    window.addEventListener('cart-updated', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await updateBadges(user.id);
    });
  }
}

/* ============================================================
   BADGES PANIER + WISHLIST
   ============================================================ */
async function updateBadges(userId) {
  // Compteur wishlist
  const { count: wishlistCount } = await supabase
    .from('wishlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Compteur panier
  const { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let cartCount = 0;
  if (cart) {
    const { count } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('cart_id', cart.id);
    cartCount = count || 0;
  }

  updateBadgeDOM('wishlist-badge', wishlistCount || 0);
  updateBadgeDOM('cart-badge', cartCount);
}

function updateBadgeDOM(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'inline-flex' : 'none';
}

/* ============================================================
   PROTECTION DE PAGE
   ============================================================ */
export async function requireAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}