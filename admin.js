import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase from env.js
const supabase = createClient(
  window.__env.SUPABASE_URL,
  window.__env.SUPABASE_ANON_KEY
);

// --- SECURE AUTH GUARD ---
// This function runs immediately to protect the page.
(async () => {
  const { data: { session } } = await supabase.auth.getSession();

  // 1. If no user is logged in, redirect them to the main login page.
  if (!session) {
    window.location.href = '/login.html';
    return;
  }

  // 2. Check the user's role in the 'profiles' table.
  // This is secure because the 'role' is set by your backend Edge Function.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  // 3. If the user's role is not 'admin', deny access and send them away.
  if (error || !profile || profile.role !== 'admin') {
    alert('Unauthorized: You do not have admin privileges.');
    // It's good practice to sign them out before redirecting.
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return;
  }
  
  // --- END OF AUTH GUARD ---
  // If the script reaches this point, the user is a verified admin.
  // The rest of your admin dashboard code can now run safely.

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      // If the admin signs out, send them to the login page.
      window.location.href = '/login.html';
    }
  });

  // Once authorized, wire up UI
  const fld = id => document.getElementById(id);
  const bonusForm      = fld('bonusForm');
  const guessListEl    = fld('guessList');
  const checkWinnerBtn = fld('checkWinnerBtn');
  const winnerResult   = fld('winnerResult');

  // Load current hunt
  async function loadCurrentHunt() {
    const { data, error } = await supabase
      .from('bonus_hunts')
      .select('*')
      .eq('is_active', true)
      .order('hunt_id',{ ascending:false })
      .limit(1)
      .single();
    if (error) return console.error(error);
    window.currentHunt = data;
    fld('hunt_id').value               = data.hunt_id;
    fld('bonuses').value               = data.bonuses;
    fld('starting_bal').value          = data.starting_bal;
    fld('ending_bal').value            = data.ending_bal;
    fld('is_active').checked           = data.is_active;
    fld('allow_guesses').checked       = data.allow_guesses;
    fld('allow_leaderboard').checked = data.allow_leaderboard;
  }

  // Submit form
  bonusForm.addEventListener('submit', async e => {
    e.preventDefault();
    await supabase.from('bonus_hunts').update({ is_active:false }).eq('is_active',true);
    const up = {
      hunt_id:           +fld('hunt_id').value,
      bonuses:           +fld('bonuses').value,
      starting_bal: +fld('starting_bal').value,
      ending_bal:   +fld('ending_bal').value,
      is_active:        fld('is_active').checked,
      allow_guesses:      fld('allow_guesses').checked,
      allow_leaderboard:  fld('allow_leaderboard').checked
    };
    const { error } = await supabase.from('bonus_hunts').upsert(up, { onConflict:'hunt_id' });
    alert(error ? `❌ ${error.message}` : '✅ Hunt updated successfully!');
    bonusForm.reset();
    await loadCurrentHunt();
    await loadGuesses();
  });

  // Load guesses list
  async function loadGuesses() {
    const { data, error } = await supabase
      .from('guesses')
      .select('hunt_id,guess,created_at,user_id,user_name')
      .order('created_at',{ ascending:false })
      .limit(50);
    if (error) return console.error(error);
    guessListEl.innerHTML = '';
    data.forEach(g => {
      const name = g.user_name || g.user_id || 'Unknown';
      const li = document.createElement('li');
      li.textContent = `User: ${name} — Hunt #${g.hunt_id}: $${g.guess.toFixed(2)} at ${new Date(g.created_at).toLocaleString()}`;
      guessListEl.appendChild(li);
    });
  }

  // Check winner
  checkWinnerBtn.addEventListener('click', async () => {
    if (!window.currentHunt) return alert('No active hunt loaded yet.');
    const { data, error } = await supabase
      .from('guesses')
      .select('guess,created_at,user_id,user_name')
      .eq('hunt_id', window.currentHunt.hunt_id);
    if (error) return alert('❌ Error checking winner.');
    if (!data.length) return alert('No guesses submitted yet.');

    const results = data.map(g => ({ ...g, diff: Math.abs(g.guess - window.currentHunt.ending_bal) }));
    const minDiff = Math.min(...results.map(r => r.diff));
    const winners = results.filter(r => r.diff === minDiff);

    winnerResult.textContent = winners
      .map(w => {
        const name = w.user_name || w.user_id || 'Unknown';
        return `🏆 ${name} guessed $${w.guess.toLocaleString()} (off by $${w.diff.toLocaleString()}) — ${new Date(w.created_at).toLocaleString()}`;
      })
      .join('\n');
  });

  // Initialize
  await loadCurrentHunt();
  await loadGuesses();
})();