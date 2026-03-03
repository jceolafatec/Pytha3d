/**
 * Viewer page logic.
 * - Reads "id" from query string
 * - Loads models.json
 * - Finds the selected model and binds it to the model-viewer
 * - Shows a few "related" models
 */

const MODELS_URL = "content/models.json";

const elements = {
  title: document.getElementById("modelTitle"),
  viewer: document.getElementById("modelViewer"),
  description: document.getElementById("modelDescription"),
  tags: document.getElementById("modelTags"),
  filePath: document.getElementById("modelFilePath"),
  related: document.getElementById("relatedModels"),
};

function getModelIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function loadModels() {
  const res = await fetch(MODELS_URL);
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function renderModel(model, allModels) {
  if (!model) {
    elements.title.textContent = "Model not found";
    elements.description.textContent =
      "The requested model could not be found. It may have been removed.";
    elements.viewer.hidden = true;
    return;
  }

  elements.title.textContent = model.name || model.id;
  elements.description.textContent =
    model.description || "No description provided yet.";
  elements.filePath.textContent = model.file || "Unknown";

  // 🎯 Load 3D model into the viewer
  if (elements.viewer && model.file) {
    elements.viewer.setAttribute("src", model.file);
    elements.viewer.setAttribute("alt", model.name || "3D model");
  }

  // Tags
  elements.tags.innerHTML = "";
  (model.tags || []).forEach((tag) => {
    const pill = document.createElement("span");
    pill.className = "model-tag-pill";
    pill.textContent = tag;
    elements.tags.appendChild(pill);
  });

  // Related models
  elements.related.innerHTML = "";
  const relatedCandidates = allModels.filter((m) => m.id !== model.id);

  relatedCandidates.slice(0, 4).forEach((m) => {
    const card = document.createElement("article");
    card.className = "model-card";

    card.addEventListener("click", () => {
      window.location.href = `model.html?id=${encodeURIComponent(m.id)}`;
    });

    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "model-card-thumb-wrapper";

    const img = document.createElement("img");
    img.className = "model-card-thumb";
    img.src = m.thumbnail || "";
    img.alt = m.name || "Model thumbnail";

    thumbWrapper.appendChild(img);

    const title = document.createElement("h3");
    title.className = "model-card-title";
    title.textContent = m.name;

    const tags = document.createElement("div");
    tags.className = "model-card-tags";
    tags.textContent =
      (m.tags && m.tags.length > 0 ? m.tags.join(" · ") : "") || "No tags";

    card.appendChild(thumbWrapper);
    card.appendChild(title);
    card.appendChild(tags);

    elements.related.appendChild(card);
  });
}

async function init() {
  const modelId = getModelIdFromUrl();

  if (!modelId) {
    elements.title.textContent = "No model selected";
    return;
  }

  try {
    const models = await loadModels();
    const model = models.find((m) => m.id === modelId);
    renderModel(model, models);
  } catch (err) {
    console.error(err);
    elements.title.textContent = "Error loading model";
    elements.description.textContent =
      "There was a problem loading model data. Check your models.json file.";
  }
}

document.addEventListener("DOMContentLoaded", init);