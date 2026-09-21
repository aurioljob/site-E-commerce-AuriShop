// js/admin-products.js
import { supabase } from './supabase.js';
import { uploadFile, deleteFile, validateImage, extractPathFromUrl } from './storage.js';
import {
  requireAdmin,
  renderAdminSidebar,
  renderAdminUser,
  formatPrice,
  openModal
} from './admin.js';

let state = {
  page: 1,
  perPage: 10,
  total: 0,
  search: '',
  categoryId: '',
  status: '',
  categories: []
};

(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  renderAdminSidebar(ctx.profile, 'products.html');
  renderAdminUser(ctx.profile);

  await loadCategories();
  await loadProducts();
  bindEvents();
})();

/* ============================================================
   CATÉGORIES (pour les filtres et le formulaire)
   ============================================================ */
async function loadCategories() {
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .order('name');

  state.categories = data || [];

  // Remplir le filtre
  const filterSelect = document.getElementById('filter-category');
  filterSelect.innerHTML = '<option value="">Toutes les catégories</option>' +
    state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/* ============================================================
   LISTE DES PRODUITS
   ============================================================ */
async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Chargement...</td></tr>';

  let query = supabase
    .from('products')
    .select(`
      id, name, slug, price, old_price, stock, is_active, brand, sku,
      category_id,
      categories(name),
      product_images(image_url, is_primary)
    `, { count: 'exact' });

  if (state.search) {
    query = query.ilike('name', `%${state.search}%`);
  }
  if (state.categoryId) {
    query = query.eq('category_id', state.categoryId);
  }
  if (state.status === 'active') {
    query = query.eq('is_active', true);
  } else if (state.status === 'inactive') {
    query = query.eq('is_active', false);
  }

  query = query.order('created_at', { ascending: false });

  const from = (state.page - 1) * state.perPage;
  query = query.range(from, from + state.perPage - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7" class="error">Erreur : ${error.message}</td></tr>`;
    return;
  }

  state.total = count || 0;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--gris-texte);">Aucun produit trouvé.</td></tr>';
    renderPagination();
    return;
  }

  tbody.innerHTML = data.map(p => {
    const img = p.product_images?.find(i => i.is_primary)?.image_url
      || p.product_images?.[0]?.image_url
      || 'https://placehold.co/48x48?text=?';

    // Badge stock
    let stockHtml;
    if (p.stock === 0) {
      stockHtml = `<span style="color:var(--error);font-weight:700;">Rupture</span>`;
    } else if (p.stock < 10) {
      stockHtml = `<span style="color:var(--warning);font-weight:700;">${p.stock}</span>`;
    } else {
      stockHtml = `<span style="font-weight:600;">${p.stock}</span>`;
    }

    return `
      <tr>
        <td><img src="${img}" alt="${p.name}"></td>
        <td>
          <strong>${p.name}</strong>
          ${p.brand ? `<div style="font-size:0.78rem;color:var(--gris-texte);">${p.brand}</div>` : ''}
        </td>
        <td>${p.categories?.name || '—'}</td>
        <td>
          <strong>${formatPrice(p.price)}</strong>
          ${p.old_price ? `<div style="font-size:0.78rem;color:var(--gris-texte);text-decoration:line-through;">${formatPrice(p.old_price)}</div>` : ''}
        </td>
        <td>${stockHtml}</td>
        <td>
          <span class="badge badge-${p.is_active ? 'active' : 'inactive'}">
            ${p.is_active ? 'Actif' : 'Inactif'}
          </span>
        </td>
        <td>
            <div class="table-actions">
                <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Modifier">
                <i data-lucide="pencil" style="width:16px;height:16px;"></i>
                </button>
                <button class="icon-btn" data-action="toggle" data-id="${p.id}" data-active="${p.is_active}" title="${p.is_active ? 'Désactiver' : 'Activer'}">
                <i data-lucide="${p.is_active ? 'eye-off' : 'eye'}" style="width:16px;height:16px;"></i>
                </button>
                <button class="icon-btn danger" data-action="delete" data-id="${p.id}" title="Supprimer">
                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>
            </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind actions
  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit') editProduct(id);
      else if (action === 'toggle') toggleProduct(id, btn.dataset.active === 'true');
      else if (action === 'delete') deleteProduct(id);
    });
    
  });
if (window.lucide) window.lucide.createIcons();

  renderPagination();
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
  const el = document.getElementById('products-pagination');
  const totalPages = Math.ceil(state.total / state.perPage);

  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) {
      html += `<button data-page="${i}" class="${i === state.page ? 'active' : ''}">${i}</button>`;
    } else if (Math.abs(i - state.page) === 2) {
      html += `<span style="padding:0 0.5rem;">…</span>`;
    }
  }

  html += `<button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;

  el.innerHTML = html;
  el.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.page = parseInt(btn.dataset.page);
      loadProducts();
    });
  });
}

async function editProduct(id = null) {
  const isEdit = id !== null;
  let product = null;

  if (isEdit) {
    const { data } = await supabase
      .from('products')
      .select('*, product_images(id, image_url, is_primary)')
      .eq('id', id)
      .single();
    product = data;
  }

  const categoryOptions = state.categories.map(c =>
    `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const currentImage = product?.product_images?.[0]?.image_url || null;

  const bodyHtml = `
    <div class="form-group">
      <label>Nom du produit *</label>
      <input type="text" id="p-name" value="${product?.name || ''}" required>
    </div>
    <div class="form-group">
      <label>Slug (URL) *</label>
      <input type="text" id="p-slug" value="${product?.slug || ''}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prix (€) *</label>
        <input type="number" id="p-price" value="${product?.price || ''}" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label>Ancien prix (€)</label>
        <input type="number" id="p-old-price" value="${product?.old_price || ''}" step="0.01" min="0">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Stock *</label>
        <input type="number" id="p-stock" value="${product?.stock ?? 0}" min="0" required>
      </div>
      <div class="form-group">
        <label>SKU</label>
        <input type="text" id="p-sku" value="${product?.sku || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Catégorie</label>
        <select id="p-category">
          <option value="">— Aucune —</option>
          ${categoryOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Marque</label>
        <input type="text" id="p-brand" value="${product?.brand || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="p-description" rows="3">${product?.description || ''}</textarea>
    </div>
    
    <div class="form-group">
      <label>Image du produit</label>
      ${currentImage ? `
        <div style="position:relative;display:inline-block;margin-bottom:0.75rem;">
          <img id="image-preview" src="${currentImage}" 
               style="max-width:200px;max-height:200px;border-radius:8px;border:1px solid var(--gris);">
          <button type="button" id="remove-image" 
                  style="position:absolute;top:4px;right:4px;width:28px;height:28px;border-radius:50%;background:var(--error);color:#fff;border:none;cursor:pointer;font-size:1rem;">×</button>
        </div>
      ` : `
        <img id="image-preview" style="display:none;max-width:200px;max-height:200px;border-radius:8px;border:1px solid var(--gris);margin-bottom:0.75rem;">
      `}
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
        <input type="file" id="image-file" accept="image/*" style="display:none;">
        <button type="button" class="btn btn-outline" id="choose-image" style="display:inline-flex;align-items:center;gap:0.5rem;">
          <i data-lucide="upload" style="width:16px;height:16px;"></i>
          Choisir une image
        </button>
        <span id="image-file-name" style="font-size:0.85rem;color:var(--gris-texte);">
          ${currentImage ? 'Image actuelle' : 'Aucun fichier sélectionné'}
        </span>
      </div>
      <small style="color:var(--gris-texte);font-size:0.8rem;display:block;margin-top:0.35rem;">
        JPG, PNG, WEBP ou GIF — max 5 MB
      </small>
    </div>

    <div class="form-group">
      <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
        <input type="checkbox" id="p-active" ${product?.is_active !== false ? 'checked' : ''}>
        Produit actif (visible sur le site)
      </label>
    </div>
  `;

  let selectedFile = null;
  let removeExistingImage = false;

  openModal({
    title: isEdit ? 'Modifier le produit' : 'Nouveau produit',
    bodyHtml,
    confirmLabel: isEdit ? 'Enregistrer' : 'Créer',

    onOpen: (overlay) => {
      const fileInput = overlay.querySelector('#image-file');
      const preview = overlay.querySelector('#image-preview');
      const fileName = overlay.querySelector('#image-file-name');
      const chooseBtn = overlay.querySelector('#choose-image');
      const removeBtn = overlay.querySelector('#remove-image');

      chooseBtn?.addEventListener('click', () => fileInput.click());

      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const check = validateImage(file);
        if (!check.valid) {
          alert(check.error);
          fileInput.value = '';
          return;
        }

        selectedFile = file;
        removeExistingImage = false;
        fileName.textContent = file.name;
        if (removeBtn) removeBtn.style.display = 'none';

        const reader = new FileReader();
        reader.onload = (ev) => {
          preview.src = ev.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      });

      removeBtn?.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        preview.src = '';
        preview.style.display = 'none';
        fileName.textContent = 'Aucun fichier sélectionné';
        removeBtn.style.display = 'none';
        removeExistingImage = true;
      });
    },

    onConfirm: async () => {
      const name = document.getElementById('p-name').value.trim();
      const slug = document.getElementById('p-slug').value.trim() ||
                   name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const price = parseFloat(document.getElementById('p-price').value);
      const oldPriceRaw = document.getElementById('p-old-price').value;
      const stock = parseInt(document.getElementById('p-stock').value);
      const sku = document.getElementById('p-sku').value.trim() || null;
      const categoryId = document.getElementById('p-category').value || null;
      const brand = document.getElementById('p-brand').value.trim() || null;
      const description = document.getElementById('p-description').value.trim() || null;
      const isActive = document.getElementById('p-active').checked;

      if (!name || !price || isNaN(price) || isNaN(stock)) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return false;
      }

      const payload = {
        name, slug, price,
        old_price: oldPriceRaw ? parseFloat(oldPriceRaw) : null,
        stock, sku,
        category_id: categoryId,
        brand, description,
        is_active: isActive,
        updated_at: new Date().toISOString()
      };

      let productId = id;

      // 1. Créer / mettre à jour le produit
      if (isEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', id);
        if (error) { alert('Erreur : ' + error.message); return false; }
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select('id').single();
        if (error) { alert('Erreur : ' + error.message); return false; }
        productId = data.id;
      }

      // 2. Gestion image
      try {
        if (selectedFile) {
          // Upload la nouvelle image
          const { url } = await uploadFile('product-images', selectedFile);

          // Supprimer l'ancienne image physique + DB
          if (isEdit && currentImage) {
            const oldPath = extractPathFromUrl(currentImage);
            if (oldPath) { try { await deleteFile('product-images', oldPath); } catch (e) {} }
            await supabase.from('product_images').delete().eq('product_id', productId);
          }

          // Insérer la nouvelle
          await supabase.from('product_images').insert({
            product_id: productId,
            image_url: url,
            is_primary: true
          });
        } else if (isEdit && removeExistingImage && currentImage) {
          // Supprimer sans remplacer
          const oldPath = extractPathFromUrl(currentImage);
          if (oldPath) { try { await deleteFile('product-images', oldPath); } catch (e) {} }
          await supabase.from('product_images').delete().eq('product_id', productId);
        }
      } catch (err) {
        console.error('Erreur image:', err);
        alert('Erreur lors de la gestion de l\'image : ' + err.message);
        // Le produit est créé, mais on ne bloque pas
      }

      await loadProducts();
      return true;
    }
  });
}

/* ============================================================
   TOGGLE ACTIF / INACTIF
   ============================================================ */
async function toggleProduct(id, isActive) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: !isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  await loadProducts();
}

/* ============================================================
   SUPPRESSION
   ============================================================ */
async function deleteProduct(id) {
  if (!confirm('Supprimer définitivement ce produit ? Cette action est irréversible.')) return;

  // Supprimer les images liées (cascade normalement, mais on force)
  await supabase.from('product_images').delete().eq('product_id', id);

  const { error } = await supabase.from('products').delete().eq('id', id);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  await loadProducts();
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */
function bindEvents() {
  // Recherche (debounce)
  let timeout;
  document.getElementById('search-products').addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadProducts();
    }, 300);
  });

  document.getElementById('filter-category').addEventListener('change', (e) => {
    state.categoryId = e.target.value;
    state.page = 1;
    loadProducts();
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadProducts();
  });

  document.getElementById('btn-new-product').addEventListener('click', () => editProduct(null));
}