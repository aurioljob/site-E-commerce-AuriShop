// js/auth.js
import { supabase } from './supabase.js';

/* ============================================================
   INSCRIPTION
   ============================================================ */
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const messageEl = document.getElementById('auth-message');
    btn.disabled = true;
    btn.textContent = 'Inscription...';

    const firstName = document.getElementById('first_name').value.trim();
    const lastName = document.getElementById('last_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    // Vérification côté client
    if (password !== confirmPassword) {
      showMessage(messageEl, 'Les mots de passe ne correspondent pas.', 'error');
      btn.disabled = false;
      btn.textContent = "S'inscrire";
      return;
    }

    if (password.length < 6) {
      showMessage(messageEl, 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
      btn.disabled = false;
      btn.textContent = "S'inscrire";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    });

    if (error) {
      showMessage(messageEl, 'Erreur : ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = "S'inscrire";
      return;
    }

    // Cas : confirmation email activée
    if (data.user && !data.session) {
      showMessage(
        messageEl,
        'Inscription réussie ! Vérifiez votre email pour confirmer votre compte.',
        'success'
      );
      registerForm.reset();
    } else {
      // Cas : confirmation email désactivée → connecté direct
      showMessage(messageEl, 'Inscription réussie ! Redirection...', 'success');
      setTimeout(() => (window.location.href = 'index.html'), 1500);
    }

    btn.disabled = false;
    btn.textContent = "S'inscrire";
  });
}

/* ============================================================
   CONNEXION
   ============================================================ */
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const messageEl = document.getElementById('auth-message');
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      let msg = error.message;
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email ou mot de passe incorrect.';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Veuillez confirmer votre email avant de vous connecter.';
      }
      showMessage(messageEl, msg, 'error');
      btn.disabled = false;
      btn.textContent = 'Se connecter';
      return;
    }

    // ✅ Redirection selon le rôle
    await redirectByRole(data.user);

    btn.disabled = false;
    btn.textContent = 'Se connecter';
  });
}

/* ============================================================
   REDIRECTION SELON LE RÔLE
   ============================================================ */
async function redirectByRole(user) {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Récupérer le rôle depuis profiles
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Erreur récupération profil:', error);
    window.location.href = 'index.html';
    return;
  }

  if (profile?.role === 'admin') {
    window.location.href = 'admin/index.html';
  } else {
    window.location.href = 'index.html';
  }
}

/* ============================================================
   GOOGLE OAUTH
   ============================================================ */
const googleBtn = document.getElementById('google-login');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/index.html'
      }
    });
    if (error) alert('Erreur Google : ' + error.message);
  });
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
function showMessage(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'auth-message ' + type;
  el.style.display = 'block';
}

// Fonction réutilisable : déconnexion
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// Fonction réutilisable : utilisateur courant
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}