const $ = (selector) => document.querySelector(selector);

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 4500);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function renderServices(services) {
  const list = $("#serviceList");
  const select = $("#enquiryService");
  list.innerHTML = "";
  select.innerHTML = '<option value="">Select a service</option>';
  if (!services.length) list.innerHTML = '<p class="empty-state">Services will be updated soon.</p>';
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

function renderReviews(reviews) {
  const list = $("#reviewList");
  list.innerHTML = "";
  if (!reviews.length) {
    list.innerHTML = '<p class="empty-state">Be the first to share your experience.</p>';
    return;
  }
  reviews.forEach(review => {
    const card = document.createElement("article");
    card.className = "review-card";
    const stars = document.createElement("div");
    stars.className = "stars";
    stars.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    const name = document.createElement("h4");
    name.textContent = review.customer_name;
    const message = document.createElement("p");
    message.textContent = review.message;
    card.append(stars, name, message);
    list.append(card);
  });
}

function renderGallery(gallery) {
  const list = $("#galleryList");
  list.innerHTML = "";
  if (!gallery.length) {
    list.innerHTML = '<p class="empty-state">Project photos will be added here from the Admin Panel.</p>';
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

async function loadWebsite() {
  const data = await api("/api/public");
  const s = data.settings;
  document.title = `${s.businessName || "FABWORKS"} | Fabrication & Welding`;
  document.querySelectorAll(".logo").forEach(el => {
    el.innerHTML = `${escapeText(s.businessName || "FABWORKS").replace(/WORKS/i, "<span>WORKS</span>")}`;
  });
  $("#heroTagline").textContent = s.tagline || "Professional Fabrication & Welding Services";
  $("#aboutText").textContent = s.about || "";
  $("#yearsBusiness").textContent = s.yearsBusiness || "5+";
  $("#yearsExperience").textContent = s.yearsExperience || "10+";
  $("#contactPhone").textContent = s.phone || "Add your phone number in Admin";
  $("#contactAddress").textContent = s.address || "Add your business address in Admin";
  $("#contactEmail").textContent = s.email || "Add your email in Admin";
  renderServices(data.services);
  renderReviews(data.reviews);
  renderGallery(data.gallery);
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

$("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
$("#mainNav").addEventListener("click", event => {
  if (event.target.tagName === "A") $("#mainNav").classList.remove("open");
});

$("#enquiryForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#enquiryStatus");
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "Sending your enquiry...";
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await api("/api/enquiries", { method: "POST", body: JSON.stringify(values) });
    form.reset();
    status.textContent = "Thank you! Your enquiry has been received. We will contact you shortly.";
    showToast("Thank you for contacting us. We will contact you shortly.");
    if (!result.whatsappSent) console.info("Enquiry saved. WhatsApp notification is not configured yet.");
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#reviewForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#reviewStatus");
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "Submitting review...";
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await api("/api/reviews", { method: "POST", body: JSON.stringify(values) });
    form.reset();
    status.textContent = result.message;
    showToast(result.message);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$("#year").textContent = new Date().getFullYear();
loadWebsite().catch(error => {
  console.error(error);
  showToast("Website data could not load. Please check that the server is running.");
});
