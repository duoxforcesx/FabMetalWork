
const $ = (selector) => document.querySelector(selector);

const API_BASE = "https://fabworks-api.duoxforcesx.workers.dev";

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 4500);
}

async function api(url, options = {}) {
  const isForm = options.body instanceof FormData;

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function renderServices(services = []) {
  const list = $("#serviceList");
  const select = $("#enquiryService");

  if (!list || !select) return;

  list.innerHTML = "";
  select.innerHTML = '<option value="">Select a service</option>';

  if (!services.length) {
    list.innerHTML =
      '<p class="empty-state">Services will be updated soon.</p>';
    return;
  }

  services.forEach((service, index) => {
    const card = document.createElement("article");
    card.className = "service-card";

    const number = document.createElement("span");
    number.className = "service-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const title = document.createElement("h3");
    title.textContent = service.title;

    const desc = document.createElement("p");
    desc.textContent = service.description;

    card.append(number, title, desc);
    list.append(card);

    const option = document.createElement("option");
    option.value = service.title;
    option.textContent = service.title;

    select.append(option);
  });
}

function renderReviews(reviews = []) {
  const list = $("#reviewList");
  if (!list) return;

  list.innerHTML = "";

  if (!reviews.length) {
    list.innerHTML =
      '<p class="empty-state">Be the first to share your experience.</p>';
    return;
  }

  reviews.forEach(review => {
    const card = document.createElement("article");
    card.className = "review-card";

    const stars = document.createElement("div");
    stars.className = "stars";
    stars.textContent =
      "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

    const name = document.createElement("h4");
    name.textContent = review.customer_name;

    const message = document.createElement("p");
    message.textContent = review.message;

    card.append(stars, name, message);
    list.append(card);
  });
}

function renderGallery(gallery = []) {
  const list = $("#galleryList");
  if (!list) return;

  list.innerHTML = "";

  if (!gallery.length) {
    list.innerHTML =
      '<p class="empty-state">Project photos will be added here from the Admin Panel.</p>';
    return;
  }

  gallery.forEach(photo => {
    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = "Fabrication and welding project";
    img.loading = "lazy";
    list.append(img);
  });
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

async function loadWebsite() {
  const data = await api("/api/public");

  const s = data.settings || {};

  document.title =
    `${s.businessName || "FABWORKS"} | Fabrication & Welding`;

  document.querySelectorAll(".logo").forEach(el => {
    el.innerHTML = escapeText(s.businessName || "FABWORKS")
      .replace(/WORKS/i, "<span>WORKS</span>");
  });

  if ($("#heroTagline")) {
    $("#heroTagline").textContent =
      s.tagline || "Professional Fabrication & Welding Services";
  }

  if ($("#aboutText")) {
    $("#aboutText").textContent = s.about || "";
  }

  if ($("#yearsBusiness")) {
    $("#yearsBusiness").textContent = s.yearsBusiness || "5+";
  }

  if ($("#yearsExperience")) {
    $("#yearsExperience").textContent = s.yearsExperience || "10+";
  }

  if ($("#contactPhone")) {
    $("#contactPhone").textContent = "+91 6262324380";
  }

  if ($("#contactAddress")) {
    $("#contactAddress").textContent =
      "NEW BUS STAND, BEHROR, KOTPUTLI-BEHROR, RAJASTHAN - 301701";
  }

  if ($("#contactEmail")) {
    $("#contactEmail").textContent = "a03124936@gmail.com";
  }

  renderServices(data.services || []);
  renderReviews(data.reviews || []);
  renderGallery(data.gallery || []);
}

// Mobile menu
if ($("#menuToggle") && $("#mainNav")) {
  $("#menuToggle").addEventListener("click", () => {
    $("#mainNav").classList.toggle("open");
  });

  $("#mainNav").addEventListener("click", event => {
    if (event.target.tagName === "A") {
      $("#mainNav").classList.remove("open");
    }
  });
}

// Website enquiry form - opens WhatsApp
if ($("#enquiryForm")) {
  $("#enquiryForm").addEventListener("submit", event => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = $("#enquiryStatus");

    const values = Object.fromEntries(
      new FormData(form).entries()
    );

    if (!values.service) {
      if (status) {
        status.textContent = "Please select a service.";
      }
      return;
    }

    const message = `
NEW WEBSITE ENQUIRY

Name: ${values.name || ""}
Mobile: ${values.mobile || ""}
Service: ${values.service || ""}
Requirement: ${values.message || ""}

Source: ASFABRICATOR Website
    `.trim();

    const whatsappURL =
      "https://wa.me/916262324380?text=" +
      encodeURIComponent(message);

    if (status) {
      status.textContent = "Opening WhatsApp...";
    }

    window.open(whatsappURL, "_blank");

    showToast(
      "Your enquiry is ready. Please press Send on WhatsApp."
    );

    if (status) {
      status.textContent =
        "Please send your enquiry on WhatsApp.";
    }
  });
}

// Customer review form
if ($("#reviewForm")) {
  $("#reviewForm").addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = $("#reviewStatus");
    const button = form.querySelector("button");

    if (button) button.disabled = true;
    if (status) status.textContent = "Submitting review...";

    const values = Object.fromEntries(
      new FormData(form).entries()
    );

    try {
      const result = await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify(values)
      });

      form.reset();

      if (status) {
        status.textContent = result.message;
      }

      showToast(result.message);
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      }
    } finally {
      if (button) button.disabled = false;
    }
  });
}

// Current year
if ($("#year")) {
  $("#year").textContent = new Date().getFullYear();
}

// Load website data
loadWebsite().catch(error => {
  console.error("Website loading error:", error);
  showToast(
    "Website data could not load. Please try again."
  );
});
