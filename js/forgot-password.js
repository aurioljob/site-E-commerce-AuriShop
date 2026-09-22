// js/forgot-password.js
import { supabase } from './supabase.js';

/* ============================================================
   PAGE : FORGOT PASSWORD (demande de lien)
   ============================================================ */
const forgotForm = document.getElementById('forgot-form');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = forgotForm.querySelector('button[type="submit"]');
    const messageEl = document.getElementById('auth-message');
    const email = document.getElementById('email').value.trim();

    btn.disabled = true;
    btn.textContent = 'Envoi en cours...';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // ⚠️ Cette URL doit être dans "Redirect URLs" de Supabase Auth
      redirectTo: `${window.location.origin}/reset-password.html`
    });

    if (error) {
      let msg = error.message;
      if (msg.includes('rate limit')) {
        msg = 'Trop de tentatives. Veuillez patienter quelques minutes.';
      }
      showMessage(messageEl, 'Erreur : ' + msg, 'error');
      btn.disabled = false;
      btn.textContent = 'Envoyer le lien de réinitialisation';
      return;
    }

    // Succès : message clair (on ne dit JAMAIS si l'email existe ou non, pour éviter l'énumération)
    showMessage(
      messageEl,
      `Si un compte existe avec l'adresse ${email}, vous recevrez un email contenant un lien de réinitialisation. Vérifiez aussi vos spams.`,
      'success'
    );
    forgotForm.reset();
    btn.disabled = false;
    btn.textContent = 'Envoyer le lien de réinitialisation';
  });
}

/* ============================================================
   PAGE : RESET PASSWORD (nouveau mot de passe)
   ============================================================ */
const resetForm = document.getElementById('reset-form');
if (resetForm) {
  initResetPassword();
}

async function initResetPassword() {
  const loadingEl = document.getElementById('reset-loading');
  const errorEl = document.getElementById('reset-error');
  const formContainer = document.getElementById('reset-form-container');

  try {
    // Supabase place les tokens dans le hash de l'URL après redirection
    // Ex : #access_token=xxx&type=recovery
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    // Vérifier que c'est bien une récupération
    if (type !== 'recovery' || !accessToken) {
      // Peut-être déjà connecté via un autre flux
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showResetError();
        return;
      }
    } else {
      // Établir la session avec les tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (sessionError) {
        console.error('Erreur session:', sessionError);
        showResetError();
        return;
      }
    }

    // Nettoyer l'URL (retirer les tokens, plus propre)
    window.history.replaceState({}, document.title, window.location.pathname);

    // Afficher le formulaire
    loadingEl.style.display = 'none';
    formContainer.style.display = 'block';

    // Bind du formulaire
    resetForm.addEventListener('submit', handleResetSubmit);

  } catch (err) {
    console.error(err);
    showResetError();
  }
}

function showResetError() {
  document.getElementById('reset-loading').style.display = 'none';
  document.getElementById('reset-error').style.display = 'block';
}

async function handleResetSubmit(e) {
  e.preventDefault();
  const btn = resetForm.querySelector('button[type="submit"]');
  const messageEl = document.getElementById('auth-message');
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm_password').value;

  // Validation
  if (password.length < 6) {
    showMessage(messageEl, 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showMessage(messageEl, 'Les mots de passe ne correspondent pas.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Mise à jour...';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    let msg = error.message;
    if (msg.includes('same password')) {
      msg = 'Le nouveau mot de passe doit être différent de l\'ancien.';
    } else if (msg.includes('weak')) {
      msg = 'Mot de passe trop faible. Utilisez au moins 6 caractères avec des lettres et des chiffres.';
    }
    showMessage(messageEl, 'Erreur : ' + msg, 'error');
    btn.disabled = false;
    btn.textContent = 'Réinitialiser mon mot de passe';
    return;
  }

  // Succès
  showMessage(messageEl, 'Mot de passe mis à jour ! Redirection vers la connexion...', 'success');

  // Déconnexion puis redirection
  setTimeout(async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  }, 2000);
}

/* ============================================================
   UTILITAIRE : message d'erreur/succès
   ============================================================ */
function showMessage(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-message ' + type;
  el.style.display = 'block';
}