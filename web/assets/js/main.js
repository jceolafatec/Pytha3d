/**
 * Main script for the portfolio index page.
 * - Loads models.json
 * - Renders cards
 * - Provides search and tag filtering
 */

const MODELS_URL = "content/models.json";

const state = {
  models: [],
  filteredModels: [],
  activeTag: null,
  searchTerm: "",
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  tagFilters: document.getElementById("tagFilters"),
  modelsGrid: document.getElementById("modelsGrid"),
  emptyState: document.getElementById("emptyState"),
};

async function loadModels() {
  try {
    const res = await fetch(MODELS_URL);
    if (!res.ok) {
      // NOTE: this must be inside backticks so ${res.status} is evaluated
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    state.models = Array.isArray(data) ? data : [];
    state.filteredModels = state.models.slice();
    renderAll();
  } catch (err) {
    console.error("Failed to load models.json", err);
    elements.emptyState.hidden = false;
    elements.emptyState.textContent =
      "Could not load models. Make sure models.json exists.";
  }
}

function renderAll() {
  applyFilters();
  renderTagFilters();
  renderModels();
}

function applyFilters() {
  const term = state.searchTerm.trim().toLowerCase();
  const activeTag = state.activeTag;

  state.filteredModels = state.models.filter((model) => {
    const matchesSearch =
      !term ||
      model.name.toLowerCase().includes(term) ||
      (model.description || "").toLowerCase().includes(term) ||
      (Array.isArray(model.tags) &&
        model.tags.some((t) => t.toLowerCase().includes(term)));

    const matchesTag =
      !activeTag ||
      (Array.isArray(model.tags) &&
        model.tags.some(
          (t) => t.toLowerCase() === activeTag.toLowerCase()
        ));

    return matchesSearch && matchesTag;
  });
}

function renderTagFilters() {
  const tags = new Set();
  state.models.forEach((m) => {
    (m.tags || []).forEach((t) => tags.add(t));
  });

  elements.tagFilters.innerHTML = "";
  if (tags.size === 0) {
    return;
  }

  // "All" button
  const allBtn = document.createElement("button");
  allBtn.textContent = "All";
  allBtn.className = "tag-pill" + (state.activeTag ? "" : " active");
  allBtn.addEventListener("click", () => {
    state.activeTag = null;
    renderAll();
  });
  elements.tagFilters.appendChild(allBtn);

  [...tags].sort().forEach((tag) => {
    const btn = document.createElement("button");
    btn.textContent = tag;
    btn.className =
      "tag-pill" + (state.activeTag === tag ? " active" : "");
    btn.addEventListener("click", () => {
      state.activeTag = state.activeTag === tag ? null : tag;
      renderAll();
    });
    elements.tagFilters.appendChild(btn);
  });
}

function renderModels() {
  const models = state.filteredModels;
  elements.modelsGrid.innerHTML = "";

  if (models.length === 0) {
    elements.emptyState.hidden = false;
    return;
  }

  elements.emptyState.hidden = true;

  models.forEach((model) => {
    const card = document.createElement("article");
    card.className = "model-card";

    card.addEventListener("click", () => {
      window.location.href = `model.html?id=${encodeURIComponent(
        model.id
      )}`;
    });

    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "model-card-thumb-wrapper";

    const thumbImg = document.createElement("img");
    thumbImg.className = "model-card-thumb";
    thumbImg.src = model.thumbnail || "";
    thumbImg.alt = model.name || "Model thumbnail";
    thumbWrapper.appendChild(thumbImg);

    const overlay = document.createElement("div");
    overlay.className = "model-card-overlay";
    thumbWrapper.appendChild(overlay);

    const badge = document.createElement("div");
    badge.className = "model-card-badge";
    badge.textContent = (model.tags && model.tags[0]) || "3D Model";
    thumbWrapper.appendChild(badge);

    const title = document.createElement("h2");
    title.className = "model-card-title";
    title.textContent = model.name;

    const tags = document.createElement("div");
    tags.className = "model-card-tags";
    tags.textContent =
      (model.tags && model.tags.length > 0
        ? model.tags.join(" · ")
        : "") || "No tags";

    const footer = document.createElement("div");
    footer.className = "model-card-footer";

    const fileLabel = document.createElement("span");
    fileLabel.textContent =
      (model.file && model.file.split("/").pop()) || "No file";

    const link = document.createElement("a");
    link.href = `model.html?id=${encodeURIComponent(model.id)}`;
    link.className = "model-card-link";
    link.addEventListener("click", (evt) => {
      evt.stopPropagation();
    });
    link.innerHTML = `View <span>→</span>`;

    footer.appendChild(fileLabel);
    footer.appendChild(link);

    card.appendChild(thumbWrapper);
    card.appendChild(title);
    card.appendChild(tags);
    card.appendChild(footer);

    elements.modelsGrid.appendChild(card);
  });
}

function initEvents() {
  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", (e) => {
      state.searchTerm = e.target.value;
      renderAll();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initEvents();
  loadModels();
});