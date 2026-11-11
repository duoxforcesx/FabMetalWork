
const $ = s => document.querySelector(s);

const API_BASE = "https://fabworks-api.duoxforcesx.workers.dev";
const TOKEN_KEY = "fabworks_admin_token";

async function api(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isForm = options.body instanceof FormData;

  const headers = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function record(title, detail, actions = "") {
  return `<article class="admin-record">
    <div><strong>${safe(title)}</strong><p>${safe(detail)}</p></div>
    <div class="admin-actions">${actions}</div>
  </article>`;
}

async function loadDashboard() {
  const data = await api("/api/admin/data");

  $("#enquiryAdminList").innerHTML =
    data.enquiries.length
      ? data.enquiries.map(e => record(
          `${e.customer_name} · ${e.mobile}`,
          `${e.service}\n${e.message}\n${e.created_at}`
        )).join("")
      : "<p>No enquiries yet.</p>";

  $("#reviewAdminList").innerHTML =
    data.reviews.length
      ? data.reviews.map(r => record(
          `${r.customer_name} · ${"★".repeat(r.rating)} · ${r.status}`,
          `${r.message}\n${r.created_at}`,
          `<button data-review="${r.id}" data-status="approved">Approve</button>
           <button data-review="${r.id}" data-status="rejected">Reject</button>
           <button data-review="${r.id}" data-status="pending">Pending</button>`
        )).join("")
      : "<p>No reviews yet.</p>";

  $("#serviceAdminList").innerHTML =
    data.services.map(s => record(
      s.title,
      s.description,
      `<button data-edit="${s.id}">Edit</button>
       <button class="delete" data-delete="${s.id}">Delete</button>`
    )).join("");

  $("#galleryAdminList").innerHTML =
    data.gallery.map(p =>
      `<figure>
        <img src="${p.url}" alt="Project photo">
        <button data-photo="${encodeURIComponent(p.name)}">Delete photo</button>
      </figure>`
    ).join("") || "<p>No photos uploaded yet.</p>";

  const form = $("#settingsForm");
  Object.keys(data.settings).forEach(key => {
    if (form.elements[key]) form.elements[key].value = data.settings[key] ?? "";
  });

  window.adminData = data;
}

function showTab(name) {
  document.querySelectorAll(".admin-panel").forEach(panel => {
    panel.hidden = panel.id !== `tab-${name}`;
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
}

async function checkLogin() {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    $("#loginPanel").hidden = false;
    $("#dashboard").hidden = true;
    return;
  }

  try {
    await api("/api/admin/me");
    $("#loginPanel").hidden = true;
    $("#dashboard").hidden = false;
    await loadDashboard();
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    $("#loginPanel").hidden = false;
    $("#dashboard").hidden = true;
    $("#loginStatus").textContent = error.message;
  }
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;

  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });

    if (!result.token) {
      throw new Error("Login token nahi mila. Worker response check karein.");
    }

    localStorage.setItem(TOKEN_KEY, result.token);
    $("#loginStatus").textContent = "";
    form.reset();

    await checkLogin();
  } catch (error) {
    $("#loginStatus").textContent = error.message;
  }
});

$("#logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  $("#loginPanel").hidden = false;
  $("#dashboard").hidden = true;
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
});

$("#reviewAdminList").addEventListener("click", async e => {
  const button = e.target.closest("[data-review]");
  if (!button) return;

  try {
    await api(`/api/admin/reviews/${button.dataset.review}`, {
      method: "PATCH",
      body: JSON.stringify({ status: button.dataset.status })
    });
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

$("#serviceForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const id = values.id;
  delete values.id;

  try {
    if (id) {
      await api(`/api/admin/services/${id}`, {
        method: "PUT",
        body: JSON.stringify(values)
      });
    } else {
      await api("/api/admin/services", {
        method: "POST",
        body: JSON.stringify(values)
      });
    }

    form.reset();
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

$("#cancelService").addEventListener("click", () => {
  $("#serviceForm").reset();
});

$("#serviceAdminList").addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");

  if (edit) {
    const item = window.adminData.services.find(
      s => s.id === Number(edit.dataset.edit)
    );

    if (!item) return;

    $("#serviceForm").elements.id.value = item.id;
    $("#serviceForm").elements.title.value = item.title;
    $("#serviceForm").elements.description.value = item.description;

    showTab("services");
    $("#serviceForm").scrollIntoView({ behavior: "smooth" });
  }

  if (del && confirm("Delete this service?")) {
    try {
      await api(`/api/admin/services/${del.dataset.delete}`, {
        method: "DELETE"
      });
      await loadDashboard();
    } catch (error) {
      alert(error.message);
    }
  }
});

$("#galleryForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const status = $("#galleryStatus");

  try {
    await api("/api/admin/gallery", {
      method: "POST",
      body: new FormData(form)
    });

    form.reset();
    status.textContent = "Photo uploaded.";
    await loadDashboard();
  } catch (error) {
    status.textContent = error.message;
  }
});

$("#galleryAdminList").addEventListener("click", async e => {
  const button = e.target.closest("[data-photo]");

  if (!button || !confirm("Delete this photo?")) return;

  try {
    await api(`/api/admin/gallery/${button.dataset.photo}`, {
      method: "DELETE"
    });
    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

$("#settingsForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const values = Object.fromEntries(new FormData(form));

  try {
    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(values)
    });

    $("#settingsStatus").textContent = "Website details saved.";
    await loadDashboard();
  } catch (error) {
    $("#settingsStatus").textContent = error.message;
  }
});

checkLogin();
