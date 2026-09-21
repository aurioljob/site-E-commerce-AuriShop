// js/admin-categories.js
import { supabase } from './supabase.js';
import {
  requireAdmin,
  renderAdminSidebar,
  renderAdminUser,
  formatDate,
  openModal
} from './admin.js';

let categories = [];

(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  renderAdminSidebar(ctx.profile, 'categories.html');
  renderAdminUser(ctx.profile);

  await loadCategories();
  bindEvents();
})();

/* ============================================================
   LISTE DES CATÉGORIES
   ============================================================ */
async function loadCategories() {
  const tbody = document.getElementById('categories-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">Chargement...</td></tr>';

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, created_at, products(id)')
    .order('name');

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="5" class="error">Erreur : ${error.message}</td></tr>`;
    return;
  }

  categories = data || [];

  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--gris-texte);">Aucune catégorie. Créez-en une !</td></tr>';
    return;
  }

  tbody.innerHTML = categories.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td><code style="background:var(--gris-clair);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.85rem;">${c.slug}</code></td>
      <td><span class="badge badge-active">${c.products?.length || 0} produits</span></td>
      <td>${formatDate(c.created_at)}</td>
      <td>
        <div class="table-actions">
            <button class="icon-btn" data-action="edit" data-id="${c.id}" title="Modifier">
            <i data-lucide="pencil" style="width:16px;height:16px;"></i>
            </button>
            <button class="icon-btn danger" data-action="delete" data-id="${c.id}" title="Supprimer">
            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
            </button>
        </div>
    </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') editCategory(id);
      else if (btn.dataset.action === 'delete') deleteCategory(id);
    });
    if (window.lucide) window.lucide.createIcons();
  });
}

/* ============================================================
   FORMULAIRE CATÉGORIE
   ============================================================ */
function editCategory(id = null) {
  const isEdit = id !== null;
  const cat = isEdit ? categories.find(c => c.id === id) : null;

  const bodyHtml = `
    <div class="form-group">
      <label>Nom de la catégorie *</label>
      <input type="text" id="c-name" value="${cat?.name || ''}" required placeholder="Électronique">
    </div>
    <div class="form-group">
      <label>Slug (URL) *</label>
      <input type="text" id="c-slug" value="${cat?.slug || ''}" required placeholder="electronique">
      <small style="color:var(--gris-texte);font-size:0.8rem;">Identifiant unique sans espaces ni accents</small>
    </div>
  `;

  openModal({
    title: isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie',
    bodyHtml,
    confirmLabel: isEdit ? 'Enregistrer' : 'Créer',
    onConfirm: async () => {
      const name = document.getElementById('c-name').value.trim();
      const slugInput = document.getElementById('c-slug').value.trim();
      const slug = slugInput || name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      if (!name) {
        alert('Le nom est obligatoire.');
        return false;
      }

      const payload = { name, slug };

      if (isEdit) {
        const { error } = await supabase.from('categories').update(payload).eq('id', id);
        if (error) { alert('Erreur : ' + error.message); return false; }
      } else {
        const { error } = await supabase.from('categories').insert(payload);
        if (error) {
          if (error.code === '23505') alert('Ce slug existe déjà.');
          else alert('Erreur : ' + error.message);
          return false;
        }
      }

      await loadCategories();
      return true;
    }
  });
}

/* ============================================================
   SUPPRESSION
   ============================================================ */
async function deleteCategory(id) {
  const cat = categories.find(c => c.id === id);
  const count = cat?.products?.length || 0;

  if (count > 0) {
    if (!confirm(`Cette catégorie contient ${count} produit(s). Les produits ne seront pas supprimés mais n'auront plus de catégorie. Continuer ?`)) return;
  } else {
    if (!confirm('Supprimer cette catégorie ?')) return;
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  await loadCategories();
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  document.getElementById('btn-new-category').addEventListener('click', () => editCategory(null));
}