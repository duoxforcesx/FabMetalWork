
const $ = s => document.querySelector(s);

const API_BASE = "https://fabworks-api.duoxforcesx.workers.dev";
const TOKEN_KEY = "fabworks_admin_token";

// API CONNECTION
async function api(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isForm = options.body instanceof FormData;

  const headers = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && url !== "/api/admin/login") {
      localStorage.removeItem(TOKEN_KEY);
    }
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

// SAFE TEXT
function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// ADMIN RECORD
function record(title, detail, actions = "") {
  return `
    <article class="admin-record">
      <div>
        <strong>${safe(title)}</strong>
        <p>${safe(detail)}</p>
      </div>
      <div class="admin-actions">${actions}</div>
    </article>
  `;
}

// LOAD DASHBOARD
async function loadDashboard() {
  const data = await api("/api/admin/data");

  const enquiries = data.enquiries || [];
  const reviews = data.reviews || [];
  const services = data.services || [];
  const gallery = data.gallery || [];
  const settings = data.settings || {};

  $("#enquiryAdminList").innerHTML = enquiries.length
    ? enquiries.map(e => record(
        `${e.customer_name} · ${e.mobile}`,
        `${e.service}\n${e.message}\n${e.created_at}`
      )).join("")
    : "<p>No enquiries yet.</p>";

  // REVIEW APPROVAL
  $("#reviewAdminList").innerHTML = reviews.length
    ? reviews.map(r => record(
        `${r.customer_name} · ${"★".repeat(Number(r.rating) || 0)} · ${r.status}`,
        `${r.message}\n${r.created_at}`,
        `
          <button class="approve" data-review="${safe(r.id)}" data-status="approved">Approve</button>
          <button class="reject" data-review="${safe(r.id)}" data-status="rejected">Reject</button>
          <button data-review="${safe(r.id)}" data-status="pending">Pending</button>
        `
      )).join("")
    : "<p>No reviews yet.</p>";

  $("#serviceAdminList").innerHTML = services.length
    ? services.map(s => record(
        s.title,
        s.description,
        `
          <button data-edit="${safe(s.id)}">Edit</button>
          <button class="delete" data-delete="${safe(s.id)}">Delete</button>
        `
      )).join("")
    : "<p>No services yet.</p>";

  $("#galleryAdminList").innerHTML = gallery.length
    ? gallery.map(p => `
        <figure>
          <img src="${safe(p.url)}" alt="Project photo">
          <button data-photo="${encodeURIComponent(p.name)}">Delete photo</button>
        </figure>
      `).join("")
    : "<p>No photos uploaded yet.</p>";

  const form = $("#settingsForm");

  Object.keys(settings).forEach(key => {
    if (form.elements[key]) {
      form.elements[key].value = settings[key] ?? "";
    }
  });

  window.adminData = data;
}

// TABS
function showTab(name) {
  document.querySelectorAll(".admin-panel").forEach(panel => {
    panel.hidden = panel.id !== `tab-${name}`;
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
}

// CHECK LOGIN
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

// ADMIN LOGIN
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const status = $("#loginStatus");
  const button = form.querySelector('button[type="submit"]');

  button.disabled = true;
  status.textContent = "Logging in...";

  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(form))
      )
    });

    if (!result.token) {
      throw new Error("Login token not received.");
    }

    localStorage.setItem(TOKEN_KEY, result.token);
    status.textContent = "";
    form.reset();

    await checkLogin();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

// LOGOUT
$("#logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  $("#dashboard").hidden = true;
  $("#loginPanel").hidden = false;
  $("#loginStatus").textContent = "You have logged out.";
});

// TAB BUTTONS
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    showTab(tab.dataset.tab);
  });
});

// REVIEW APPROVAL
$("#reviewAdminList").addEventListener("click", async e => {
  const button = e.target.closest("[data-review]");
  if (!button) return;

  button.disabled = true;

  try {
    await api(
      `/api/admin/reviews/${encodeURIComponent(button.dataset.review)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: button.dataset.status
        })
      }
    );

    await loadDashboard();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
});

// ADD / EDIT SERVICE
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
    alert("Service saved successfully.");
  } catch (error) {
    alert(error.message);
  }
});

// CLEAR SERVICE FORM
$("#cancelService").addEventListener("click", () => {
  $("#serviceForm").reset();
});

// EDIT / DELETE SERVICE
$("#serviceAdminList").addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");

  if (edit) {
    const item = window.adminData.services.find(
      s => String(s.id) === edit.dataset.edit
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

// PHOTO UPLOAD
$("#galleryForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const status = $("#galleryStatus");

  const fileInput = form.querySelector('input[type="file"]');

  if (!fileInput || !fileInput.files.length) {
    status.textContent = "Please select a photo.";
    return;
  }

  status.textContent = "Uploading photo...";

  try {
    await api("/api/admin/gallery", {
      method: "POST",
      body: new FormData(form)
    });

    form.reset();
    status.textContent = "Photo uploaded successfully.";

    await loadDashboard();
  } catch (error) {
    status.textContent = error.message;
  }
});

// DELETE PHOTO
$("#galleryAdminList").addEventListener("click", async e => {
  const button = e.target.closest("[data-photo]");

  if (!button || !confirm("Delete this photo?")) return;

  try {
    await api(
      `/api/admin/gallery/${button.dataset.photo}`,
      { method: "DELETE" }
    );

    await loadDashboard();
  } catch (error) {
    alert(error.message);
  }
});

// SAVE WEBSITE SETTINGS
$("#settingsForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const status = $("#settingsStatus");

  status.textContent = "Saving...";

  try {
    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(values)
    });

    status.textContent = "Website details saved.";
    await loadDashboard();
  } catch (error) {
    status.textContent = error.message;
  }
});

// START
checkLogin();
