// js/admin-reviews.js
import { supabase } from './supabase.js';
import {
  requireAdmin,
  renderAdminSidebar,
  renderAdminUser,
  formatDate
} from './admin.js';

let state = { status: '' };

(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  renderAdminSidebar(ctx.profile, 'reviews.html');
  renderAdminUser(ctx.profile);

  await loadReviews();
  bindEvents();
})();

async function loadReviews() {
  const container = document.getElementById('reviews-container');
  container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--gris-texte);">Chargement...</p>';

  let query = supabase
    .from('reviews')
    .select(`
      id, rating, comment, is_approved, created_at,
      user_id, product_id,
      profiles(first_name, last_name),
      products(name)
    `)
    .order('created_at', { ascending: false });

  if (state.status === 'pending') query = query.eq('is_approved', false);
  else if (state.status === 'approved') query = query.eq('is_approved', true);

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<p class="error" style="text-align:center;padding:2rem;">Erreur : ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--gris-texte);">Aucun avis à afficher.</p>';
    return;
  }

  container.innerHTML = data.map(r => {
    const author = r.profiles
      ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || 'Client'
      : 'Client';
    const productName = r.products?.name || '—';

    return `
      <div class="admin-panel" style="margin-bottom:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:0.75rem;">
          <div>
            <strong>${author}</strong>
            <div style="font-size:0.82rem;color:var(--gris-texte);">
              sur <em>${productName}</em> · ${formatDate(r.created_at)}
            </div>
          </div>
          <div>
            <span style="color:#fbbf24;font-size:1.1rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            <span class="badge badge-${r.is_approved ? 'active' : 'pending'}" style="margin-left:0.5rem;">
              ${r.is_approved ? 'Approuvé' : 'En attente'}
            </span>
          </div>
        </div>
        ${r.comment ? `<p style="color:var(--gris-texte);line-height:1.6;margin-bottom:1rem;">${r.comment}</p>` : ''}
        <div class="table-actions">
            ${!r.is_approved ? `
                <button class="btn btn-primary" data-action="approve" data-id="${r.id}" style="padding:0.5rem 1rem;font-size:0.85rem;display:inline-flex;align-items:center;gap:0.4rem;">
                <i data-lucide="check" style="width:14px;height:14px;"></i>
                Approuver
                </button>
            ` : ''}
            <button class="btn btn-outline" data-action="delete" data-id="${r.id}" style="padding:0.5rem 1rem;font-size:0.85rem;display:inline-flex;align-items:center;gap:0.4rem;">
                <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                Supprimer
            </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'approve') approveReview(id);
      else if (btn.dataset.action === 'delete') deleteReview(id);
    });
    if (window.lucide) window.lucide.createIcons();
  });
}

async function approveReview(id) {
  const { error } = await supabase
    .from('reviews')
    .update({ is_approved: true })
    .eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  await loadReviews();
}

async function deleteReview(id) {
  if (!confirm('Supprimer cet avis définitivement ?')) return;
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  await loadReviews();
}

function bindEvents() {
  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.status = e.target.value;
    loadReviews();
  });
}