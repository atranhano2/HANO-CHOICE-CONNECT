// Storage keys
const STORAGE_KEYS = {
  USERS: "hcc_users",
  CURRENT_USER: "hcc_current_user",
  PROPERTIES: "hcc_properties",
  FAVORITES: "hcc_favorites",
};

// Basic storage helpers
function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
}
function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}
function getCurrentUser() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || "null");
}
function setCurrentUser(user) {
  if (!user) localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  else localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}
function getProperties() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROPERTIES) || "[]");
}
function saveProperties(props) {
  localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(props));
}
function getFavorites() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || "[]");
}
function saveFavorites(list) {
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(list));
}

// Seed demo properties
(function seedDemo() {
  if (getProperties().length === 0) {
    saveProperties([
      {
        id: "demo-1",
        title: "2BR in Historic District",
        address: "123 Oak Street, New Orleans, LA",
        price: 1450,
        beds: 2,
        baths: 1,
        sqft: 900,
        description:
          "Renovated shotgun-style home with updated kitchen, in-unit laundry, and access to transit.",
        image: "assets/img/sample-property.jpg",
        createdBy: "demo-landlord",
        entityId: "L-00001",
        acc: ["Wheelchair Accessible", "Ramp"],
        lat: 29.9611,
        lng: -90.0715,
      },
      {
        id: "demo-2",
        title: "Accessible Ground-Floor Unit",
        address: "456 Riverfront Ave, New Orleans, LA",
        price: 1200,
        beds: 1,
        baths: 1,
        sqft: 650,
        description:
          "Ground-floor unit with ramp access, widened doors, and nearby grocery and bus lines.",
        image: "assets/img/sample-property.jpg",
        createdBy: "demo-landlord",
        entityId: "L-00001",
        acc: ["Ramp", "Wide Doors", "Grab Bars"],
        lat: 29.9511,
        lng: -90.0815,
      },
    ]);
  }
})();

// Auth

function handleRegister(formId, role) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const entityId = form.entityId.value.trim();
    const password = form.password.value.trim();
    const errorEl = form.querySelector(".form-error");

    if (!entityId) {
      errorEl.textContent = "Entity ID is required to create an account.";
      return;
    }

    const users = getUsers();
    if (users.some((u) => u.email === email)) {
      errorEl.textContent = "An account with this email already exists.";
      return;
    }

    const user = {
      id: `user-${Date.now()}`,
      name,
      email,
      entityId,
      role,
      password,
    };

    users.push(user);
    saveUsers(users);
    setCurrentUser(user);

    errorEl.textContent = "";
    window.location.href = role === "tenant" ? "tenants.html" : "landlords.html";
  });
}

function handleLogin(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value.trim();
    const errorEl = form.querySelector(".form-error");

    const users = getUsers();
    const user = users.find((u) => u.email === email && u.password === password);

    if (!user) {
      errorEl.textContent = "Invalid credentials. Check email and password.";
      return;
    }

    setCurrentUser(user);
    errorEl.textContent = "";
    window.location.href = user.role === "tenant" ? "tenants.html" : "landlords.html";
  });
}

function requireRole(role) {
  const user = getCurrentUser();
  if (!user || (role && user.role !== role)) {
    window.location.href = "login.html";
  }
}

function attachLogout(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    setCurrentUser(null);
    window.location.href = "index.html";
  });
}

// Verification

const VERIFIED_ENTITIES = ["L-00001"];

function isVerifiedLandlord(entityId) {
  return VERIFIED_ENTITIES.includes(entityId);
}

// Favorites

function toggleFavorite(id) {
  let favs = getFavorites();
  if (favs.includes(id)) {
    favs = favs.filter((f) => f !== id);
  } else {
    favs.push(id);
  }
  saveFavorites(favs);
  alert("Favorites updated.");
}

// Map (Leaflet + OSM)

let map;
let markers = [];

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  map = L.map("map").setView([29.9511, -90.0715], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  updateMap(getProperties());
}

function updateMap(properties) {
  if (!map) return;

  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  properties.forEach((p) => {
    if (!p.lat || !p.lng) return;
    const marker = L.marker([p.lat, p.lng]).addTo(map);
    marker.bindPopup(`<strong>${p.title}</strong><br>${p.address}`);
    markers.push(marker);
  });

  if (markers.length) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2));
  }
}

// Geocoding (Nominatim)

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    const data = await res.json();
    if (data.length) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocoding failed", e);
  }
  return null;
}

// Tenant property rendering

function renderTenantProperties(containerId, list = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const properties = list || getProperties();
  const favs = getFavorites();

  if (properties.length === 0) {
    container.innerHTML = "<p>No properties match your criteria.</p>";
    if (map) updateMap([]);
    return;
  }

  container.innerHTML = properties
    .map(
      (p) => `
      <article class="card property-card">
        <img src="${p.image}" alt="${p.title}" class="property-image" />
        <div class="card-header">
          <div class="card-title">${p.title}</div>
          <span class="card-tag">${p.beds} bd • ${p.baths} ba</span>
        </div>
        <div class="card-body">
          <div>${p.address}</div>
          <div class="chip-row">
            <span class="chip">${p.sqft} sq ft</span>
            <span class="chip">Entity ID: ${p.entityId}</span>
            ${
              isVerifiedLandlord(p.entityId)
                ? `<span class="chip" style="background:#22c55e33; border-color:#22c55e;">✔ Verified Landlord</span>`
                : ""
            }
          </div>
          ${
            p.acc && p.acc.length
              ? `<div class="chip-row" style="margin-top:0.4rem;">
                  ${p.acc.map((a) => `<span class="chip">${a}</span>`).join("")}
                 </div>`
              : ""
          }
          <p style="margin-top:0.4rem;">${p.description}</p>
        </div>
        <div class="card-footer">
          <span class="property-price">$${p.price.toLocaleString()}/mo</span>
          <div style="display:flex; gap:0.4rem;">
            <a href="property.html?id=${encodeURIComponent(
              p.id
            )}" class="btn btn-outline" style="font-size:0.78rem;">View</a>
            <button class="btn btn-outline" style="font-size:0.78rem;"
              onclick="toggleFavorite('${p.id}')">
              ${favs.includes(p.id) ? "💔 Unsave" : "❤️ Save"}
            </button>
          </div>
        </div>
      </article>
    `
    )
    .join("");

  if (map) updateMap(properties);
}

// Property detail

function renderPropertyDetail(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const properties = getProperties();
  const property = properties.find((p) => p.id === id) || properties[0];

  if (!property) {
    container.innerHTML = "<p>Property not found.</p>";
    return;
  }

  container.innerHTML = `
    <div class="card">
      <img src="${property.image}" alt="${property.title}" class="property-image" />
      <h2 style="margin-top:0.75rem;">${property.title}</h2>
      <p style="color:var(--muted); margin-top:0.25rem;">${property.address}</p>
      <div class="chip-row" style="margin-top:0.5rem;">
        <span class="chip">${property.beds} bedrooms</span>
        <span class="chip">${property.baths} bathrooms</span>
        <span class="chip">${property.sqft} sq ft</span>
        <span class="chip">Entity ID: ${property.entityId}</span>
        ${
          isVerifiedLandlord(property.entityId)
            ? `<span class="chip" style="background:#22c55e33; border-color:#22c55e;">✔ Verified Landlord</span>`
            : ""
        }
      </div>
      ${
        property.acc && property.acc.length
          ? `<div class="chip-row" style="margin-top:0.5rem;">
              ${property.acc.map((a) => `<span class="chip">${a}</span>`).join("")}
             </div>`
          : ""
      }
      <p style="margin-top:0.75rem;">${property.description}</p>
      <div style="margin-top:0.75rem; display:flex; justify-content:space-between; align-items:center;">
        <span class="property-price" style="font-size:1.2rem;">$${property.price.toLocaleString()}/mo</span>
        <span style="font-size:0.8rem; color:var(--muted);">Listing ID: ${property.id}</span>
      </div>
    </div>
  `;
}

// Landlord property form

function handlePropertyForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    const errorEl = form.querySelector(".form-error");

    if (!user || user.role !== "landlord") {
      errorEl.textContent = "You must be logged in as a Landlord to post properties.";
      return;
    }

    const title = form.title.value.trim();
    const address = form.address.value.trim();
    const price = Number(form.price.value);
    const beds = Number(form.beds.value);
    const baths = Number(form.baths.value);
    const sqft = Number(form.sqft.value);
    const description = form.description.value.trim();
    const image = form.image.value.trim() || "assets/img/sample-property.jpg";
    const accFeatures = [...form.querySelectorAll("input[name='acc']:checked")].map(
      (c) => c.value
    );

    if (!title || !address || !price) {
      errorEl.textContent = "Title, address, and price are required.";
      return;
    }

    const geo = await geocodeAddress(address);

    const properties = getProperties();
    const property = {
      id: `prop-${Date.now()}`,
      title,
      address,
      price,
      beds,
      baths,
      sqft,
      description,
      image,
      createdBy: user.id,
      entityId: user.entityId,
      acc: accFeatures,
      lat: geo?.lat || null,
      lng: geo?.lng || null,
    };

    properties.push(property);
    saveProperties(properties);
    errorEl.textContent = "";
    form.reset();
    alert("Property posted successfully.");
    renderLandlordProperties("landlordProperties");
  });
}

// Landlord listings

function renderLandlordProperties(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = getCurrentUser();
  const properties = getProperties().filter((p) => p.createdBy === user?.id);

  if (properties.length === 0) {
    container.innerHTML = "<p>You haven't posted any properties yet.</p>";
    return;
  }

  container.innerHTML = properties
    .map(
      (p) => `
      <article class="card property-card">
        <img src="${p.image}" alt="${p.title}" class="property-image" />
        <div class="card-header">
          <div class="card-title">${p.title}</div>
          <span class="card-tag">$${p.price.toLocaleString()}/mo</span>
        </div>
        <div class="card-body">
          <div>${p.address}</div>
          <div class="chip-row">
            <span class="chip">${p.beds} bd</span>
            <span class="chip">${p.baths} ba</span>
            <span class="chip">${p.sqft} sq ft</span>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

// Tenant filters

function applyTenantFilters() {
  const minPrice = Number(document.getElementById("filterMinPrice").value) || 0;
  const maxPrice =
    Number(document.getElementById("filterMaxPrice").value) || Infinity;
  const beds = Number(document.getElementById("filterBeds").value) || 0;
  const keyword = document
    .getElementById("filterKeyword")
    .value.trim()
    .toLowerCase();

  const allProps = getProperties();

  const filtered = allProps.filter((p) => {
    const matchesPrice = p.price >= minPrice && p.price <= maxPrice;
    const matchesBeds = beds === 0 || p.beds >= beds;
    const matchesKeyword =
      keyword === "" ||
      p.title.toLowerCase().includes(keyword) ||
      p.address.toLowerCase().includes(keyword) ||
      p.description.toLowerCase().includes(keyword);

    return matchesPrice && matchesBeds && matchesKeyword;
  });

  renderTenantProperties("tenantProperties", filtered);
}
