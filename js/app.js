// shared functions used across all pages

function isLoggedIn() {
  return localStorage.getItem("kns_user") !== null;
}

function logout() {
  localStorage.removeItem("kns_user");
  window.location.href = "index.html";
}

function updateNavbar() {
  const loginBtn = document.querySelector("#nav-login-btn");
  const userArea = document.querySelector("#nav-user-area");

  if (isLoggedIn()) {
    if (loginBtn) loginBtn.style.display = "none";
    if (userArea) userArea.style.display = "flex";
  } else {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (userArea) userArea.style.display = "none";
  }
}

// favourites stored in localStorage as an array of ids
function getFavourites() {
  const stored = localStorage.getItem("kns_favourites");

  if (stored) {
    return JSON.parse(stored);
  }

  return [];
}

function isFavourite(id) {
  return getFavourites().indexOf(String(id)) !== -1;
}

function toggleFavourite(id) {
  const favs = getFavourites();
  const strId = String(id);
  const index = favs.indexOf(strId);

  if (index === -1) {
    favs.push(strId);
    localStorage.setItem("kns_favourites", JSON.stringify(favs));
    return true;
  } else {
    favs.splice(index, 1);
    localStorage.setItem("kns_favourites", JSON.stringify(favs));
    return false;
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then(() => console.log("Service Worker Registered"))
    .catch((err) => console.log("SW registration failed:", err));
}
