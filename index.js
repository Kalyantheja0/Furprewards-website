import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase
const supabase = createClient(
  window.__env.SUPABASE_URL,
  window.__env.SUPABASE_ANON_KEY
);

document.addEventListener('DOMContentLoaded', () => {
  // Splash "Enter" button
  const enterBtn = document.getElementById('enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      document.getElementById('splash-screen').classList.add('hide');
    });
  }

  // Auth & Navbar
  initAuth();

  // Kick popup
  document.querySelector('.kick-popup .close-btn').addEventListener('click', () => {
    document.getElementById('kickPopup').style.display = 'none';
  });
  checkFurpLive();

  // Starfield
  startStarfield();
});

async function initAuth() {
  const loginLink = document.getElementById('login-link');
  const logoutLink = document.getElementById('logout-link');
  const loginName = document.getElementById('loginName');
  const userAvatar = document.querySelector('.avatar');

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // User is logged in
    loginLink.style.display = 'none'; // Hide login button
    logoutLink.style.display = 'block'; // Show logout button

    // Update user display name and avatar
    const user = session.user;
    const name = user.user_metadata?.custom_claims?.global_name || user.user_metadata?.full_name || 'User';
    const avatarUrl = user.user_metadata?.avatar_url;
    
    loginName.innerText = name;
    if (avatarUrl) {
      userAvatar.src = avatarUrl;
    }

    // Set up the logout functionality
    logoutLink.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/login.html';
    });
    
  } else {
    // User is logged out
    loginLink.style.display = 'block'; // Show login button
    logoutLink.style.display = 'none'; // Hide logout button
    loginName.innerText = 'Login';
    userAvatar.src = 'images/login.png'; // Reset to default avatar
  }
}

async function checkFurpLive() {
  try {
    const res = await fetch("https://kick.com/api/v1/channels/furp");
    const data = await res.json();
    const popup = document.getElementById("kickPopup");
    const content = document.getElementById("kickContent");
    content.innerHTML = data.livestream
      ? '<iframe src="https://kick.com/embed/furp" allowfullscreen></iframe>'
      : '<div class="offline-message">Furp is currently offline</div>';
    popup.style.display = "block";
  } catch (err) {
    console.error(err);
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
  const pos = new Float32Array(8000*3).map(() => (Math.random()-0.5)*2000);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size:1 }));
  scene.add(stars);

  (function animate(){
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