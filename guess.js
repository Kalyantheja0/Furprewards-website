import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  window.__env.SUPABASE_URL,
  window.__env.SUPABASE_ANON_KEY
);

let huntData = null;
let userId = null;
let userName = 'Guest';

document.addEventListener('DOMContentLoaded', async () => {
  // Auth
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert('Please log in to participate.');
    window.location.href = '/login.html';
    return;
  }
  userId = session.user.id;
  const u = session.user;
  userName = u.user_metadata?.custom_claims?.global_name
           || u.user_metadata?.full_name
           || u.email
           || 'Guest';

  // This line was added to update the login name on the page.
  document.getElementById('loginName').textContent = userName;

  // --- ADMIN CHECK ---
  // Check the user's role from the 'profiles' table.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  // If the user's role is 'admin', find all admin links and make them visible.
  if (profile && profile.role === 'admin') {
    const adminLinks = document.querySelectorAll('.admin-only-link');
    adminLinks.forEach(link => {
      link.classList.remove('d-none');
    });
  }
  // --- END OF ADMIN CHECK ---

  supabase.auth.onAuthStateChange((_, event) => {
    if (event === 'SIGNED_OUT') window.location.href = '/login.html';
  });

  // Load data & wire button
  await loadActiveHunt();
  document.getElementById('submitBtn').addEventListener('click', submitGuess);

  // Start starfield
  startStarfield();
});

async function loadActiveHunt() {
  const { data, error } = await supabase
    .from('bonus_hunts')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error('No active hunt found.');
    document.getElementById('guessSection').innerHTML = '<h2>No active hunt is currently running. Check back soon!</h2>';
    document.getElementById('leaderboardSection').style.display = 'none';
    return;
  }

  huntData = data;
  document.getElementById('huntId').textContent      = `#${data.hunt_id}`;
  document.getElementById('bonuses').textContent     = data.bonuses;
  document.getElementById('startingBal').textContent = `$${data.starting_bal.toLocaleString()}`;
  document.getElementById('endingBal').textContent   = data.ending_bal ? `$${data.ending_bal.toLocaleString()}` : 'TBD';

  document.getElementById('guessSection').style.display       = data.allow_guesses      ? 'block' : 'none';
  document.getElementById('leaderboardSection').style.display = data.allow_leaderboard ? 'block' : 'none';

  if (data.allow_leaderboard) await loadLeaderboard();
}

async function loadLeaderboard() {
  if (!huntData.ending_bal) {
    document.getElementById('leaderboardSection').style.display = 'none';
    return; // Don't show leaderboard if there's no ending balance to compare against
  }

  const { data, error } = await supabase
    .from('guesses')
    .select('user_name,guess,created_at')
    .eq('hunt_id', huntData.hunt_id);
  if (error) return console.error(error);

  const list = data
    .map(g => ({ ...g, diff: Math.abs(g.guess - huntData.ending_bal) }))
    .sort((a,b) => a.diff - b.diff)
    .slice(0,10);

  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '';
  list.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${r.user_name}</td>
      <td>$${r.guess.toLocaleString()}</td>
      <td>$${r.diff.toLocaleString()}</td>
      <td>${new Date(r.created_at).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function submitGuess() {
  const val = parseFloat(document.getElementById('userGuess').value);
  const feedback = document.getElementById('feedback');

  if (isNaN(val) || val <= 0) {
    feedback.textContent = '❌ Please enter a valid, positive number.';
    return;
  }
  feedback.textContent = '⏳ Saving your guess…';

  const { error } = await supabase
    .from('guesses')
    .insert([{ hunt_id: huntData.hunt_id, guess: val, user_id: userId, user_name: userName }]);

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
        feedback.textContent = '❌ You have already submitted a guess for this hunt.';
    } else {
        feedback.textContent = `❌ ${error.message}`;
    }
  } else {
    feedback.textContent = `✅ Thanks, ${userName}! Your guess of $${val.toLocaleString()} was saved.`;
    if (huntData.allow_leaderboard) await loadLeaderboard();
  }
}

function startStarfield() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
  camera.position.z = 1;
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(innerWidth, innerHeight);
  document.getElementById('three-container').appendChild(renderer.domElement);

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(8000*3).map(() => (Math.random()-0.5)*2000);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1 }));
  scene.add(stars);

  (function animate() {
    requestAnimationFrame(animate);
    stars.rotation.x += 0.001;
    stars.rotation.y += 0.002;
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}