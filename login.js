// login.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Use env.js for URLs & keys
const supabase = createClient(
  window.__env.SUPABASE_URL,
  window.__env.SUPABASE_ANON_KEY
);

document
  .getElementById('discordLogin')
  .addEventListener('click', () => {
    supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        // After login, redirect here:
        redirectTo: window.location.origin + '/index.html'
      }
    });
  });
