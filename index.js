import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase
const supabase = createClient(
  window.__env.SUPABASE_URL,
  window.__env.SUPABASE_ANON_KEY
);

document.addEventListener('DOMContentLoaded', () => {
  // --- SAFE INITIALIZATION ---
  // These functions will now only run if the necessary elements exist on the page.

  // Splash "Enter" button (only on index.html)
  const enterBtn = document.getElementById('enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      const splashScreen = document.getElementById('splash-screen');
      if (splashScreen) {
        splashScreen.classList.add('hide');
      }
    });
  }

  // Auth & Navbar (runs on all pages)
  initAuth();

  // Kick popup (only on index.html)
  const kickPopup = document.getElementById("kickPopup");
  if (kickPopup) {
    const closeBtn = kickPopup.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        kickPopup.style.display = 'none';
      });
    }
    checkFurpLive();
  }

  // Starfield (runs on all pages)
  const threeContainer = document.getElementById('three-container');
  if (threeContainer) {
    startStarfield(threeContainer);
  }
});

async function initAuth() {
  const loginLink = document.getElementById('login-link');
  const logoutLink = document.getElementById('logout-link');
  const loginName = document.getElementById('loginName');
  const userAvatar = document.querySelector('.avatar');

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // User is logged in
    if(loginLink) loginLink.style.display = 'none';
    if(logoutLink) logoutLink.style.display = 'block';

    // Update user display name and avatar
    const user = session.user;
    const name = user.user_metadata?.custom_claims?.global_name || user.user_metadata?.full_name || 'User';
    const avatarUrl = user.user_metadata?.avatar_url;
    
    if(loginName) loginName.innerText = name;
    if (avatarUrl && userAvatar) {
      userAvatar.src = avatarUrl;
    }

    // Set up the logout functionality
    if(logoutLink) {
        logoutLink.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/login.html';
        });
    }
    
  } else {
    // User is logged out
    if(loginLink) loginLink.style.display = 'block';
    if(logoutLink) logoutLink.style.display = 'none';
    if(loginName) loginName.innerText = 'Login';
    if(userAvatar) userAvatar.src = 'images/login.png';
  }
}

async function checkFurpLive() {
  try {
    const res = await fetch("https://kick.com/api/v1/channels/furp");
    const data = await res.json();
    const popup = document.getElementById("kickPopup");
    const content = document.getElementById("kickContent");
    if(popup && content) {
        content.innerHTML = data.livestream
          ? '<iframe src="https://kick.com/embed/furp" allowfullscreen></iframe>'
          : '<div class="offline-message">Furp is currently offline</div>';
        popup.style.display = "block";
    }
  } catch (err) {
    console.error("Error checking Kick status:", err);
  }
}

function startStarfield(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 1;
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

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
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
