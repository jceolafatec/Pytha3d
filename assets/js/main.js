/**
 * Portfolio homepage logic
 * - Loads groups from assets/data/projects.json (source: auto-content)
 * - Renders one card per content folder
 * - Links to per-group gallery page
 */

const CONFIG = {
    projectsDataPath: "assets/data/projects.json",
    contentGridId: "content-grid",
    modelsGridId: "models-grid",
};

function escapeHTML(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return String(text || "").replace(/[&<>"']/g, (m) => map[m]);
}

function extractGroupSlug(project) {
    const assetKey = String(project.asset_key || "");
    if (assetKey.toLowerCase().startsWith("content/")) {
        return assetKey.split("/")[1] || "";
    }

    const imagePath = String(project.image || "").replace(/\\/g, "/");
    const parts = imagePath.split("/");
    const contentIdx = parts.findIndex((part) => part.toLowerCase() === "content");
    if (contentIdx >= 0 && parts[contentIdx + 1]) {
        return parts[contentIdx + 1];
    }

    return "";
}

function getGroupImageCount(project) {
    if (Array.isArray(project.gallery_images)) {
        return project.gallery_images.length;
    }
    return project.image ? 1 : 0;
}

function createGroupCard(project) {
    const groupSlug = extractGroupSlug(project);

    const article = document.createElement("article");
    article.className = "project-card group-tile";
    article.setAttribute("data-group", groupSlug);

    const inner = project.image
        ? `<img src="${escapeHTML(project.image)}" alt="${escapeHTML(project.title)}" loading="lazy" />`
        : `<div class="tile-placeholder"></div>`;

    article.innerHTML = `
        <a href="project-detail.html?group=${encodeURIComponent(groupSlug)}" class="group-card-link" aria-label="Open ${escapeHTML(project.title)} gallery">
            <div class="tile-media">
                ${inner}
                <div class="tile-overlay">
                    <span class="tile-title">${escapeHTML(project.title)}</span>
                </div>
            </div>
        </a>
    `;

    return article;
}

function createModelCard(project) {
    const modelPath = String(project.model_path || "");
    const folderPath = modelPath.substring(0, modelPath.lastIndexOf("/") + 1);
    const viewerUrl = `viewer.html?model=${encodeURIComponent(modelPath)}`;

    const article = document.createElement("article");
    article.className = "project-card group-tile";

    const inner = project.image
        ? `<img src="${escapeHTML(project.image)}" alt="${escapeHTML(project.title)}" loading="lazy" />`
        : `<div class="tile-placeholder model-placeholder"><span class="placeholder-icon">&#x2B21;</span></div>`;

    article.innerHTML = `
        <a href="${escapeHTML(viewerUrl)}" class="group-card-link" aria-label="View ${escapeHTML(project.title)} 3D model">
            <div class="tile-media">
                ${inner}
                <div class="tile-overlay">
                    <span class="tile-title">${escapeHTML(project.title)}</span>
                    <span class="tile-badge">3D</span>
                </div>
            </div>
        </a>
    `;

    return article;
}

function renderGroups(projects) {
    const grid = document.getElementById(CONFIG.contentGridId);
    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    if (!projects.length) {
        const msg = document.createElement("p");
        msg.style.cssText = "grid-column: 1/-1; text-align: center; color: #999;";
        msg.textContent = "No content groups found in assets/content.";
        grid.appendChild(msg);
        return;
    }

    projects.forEach((project) => {
        grid.appendChild(createGroupCard(project));
    });
}

async function loadModelsGrid() {
    const grid = document.getElementById(CONFIG.modelsGridId);
    if (!grid) {
        return;
    }

    try {
        const response = await fetch(CONFIG.projectsDataPath);
        if (!response.ok) {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">No 3D models found.</p>';
            return;
        }

        const data = await response.json();
        const models = Array.isArray(data)
            ? data.filter(
                  (p) =>
                      String(p.source || "").toLowerCase() === "auto-model" &&
                      String(p.model_path || "").trim()
              )
            : [];

        models.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

        grid.innerHTML = "";

        if (!models.length) {
            grid.innerHTML =
                '<p style="grid-column:1/-1;text-align:center;color:#999;">No 3D models found in assets/models.</p>';
            return;
        }

        models.forEach((project) => {
            grid.appendChild(createModelCard(project));
        });
    } catch (error) {
        console.error("Failed to load models grid:", error);
    }
}

async function loadGroups() {
    try {
        const response = await fetch(CONFIG.projectsDataPath);
        if (!response.ok) {
            renderGroups([]);
            return;
        }

        const data = await response.json();
        const groups = Array.isArray(data)
            ? data.filter((project) => String(project.source || "").toLowerCase() === "auto-content")
            : [];

        groups.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
        renderGroups(groups);
    } catch (error) {
        console.error("Failed to load groups:", error);
        renderGroups([]);
    }
}

function setFooterYear() {
    const yearEl = document.getElementById("year");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
}

function initNav() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");

    if (!header || !toggle) {
        return;
    }

    toggle.addEventListener("click", () => {
        const isOpen = header.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
    });

    header.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (!link) {
            return;
        }
        if (header.classList.contains("nav-open")) {
            header.classList.remove("nav-open");
            toggle.setAttribute("aria-expanded", "false");
        }
    });
}

function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href");
            if (!href || href === "#") {
                return;
            }

            const target = document.querySelector(href);
            if (!target) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

function initContactForm() {
    const openBtn = document.getElementById("open-chatbot");
    const closeBtn = document.getElementById("close-contact");
    const backdrop = document.getElementById("contact-backdrop");
    const panel = document.getElementById("contact-panel");
    const form = document.getElementById("contact-form");
    const nameField = document.getElementById("contact-name");
    const emailField = document.getElementById("contact-email");
    const phoneField = document.getElementById("contact-phone");
    const projectTypeField = document.getElementById("contact-project-type");
    const timelineField = document.getElementById("contact-timeline");
    const budgetField = document.getElementById("contact-budget");
    const briefField = document.getElementById("contact-brief");
    const measurementsField = document.getElementById("contact-measurements");
    const plansField = document.getElementById("contact-plans");
    const feedback = document.getElementById("contact-form-feedback");
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const uploadConfig = window.PYTHA_CONTACT_UPLOAD_CONFIG || {};
    const maxFilesPerInquiry = 10;
    const maxFileSizeMb = 20;

    if (
        !openBtn ||
        !closeBtn ||
        !backdrop ||
        !panel ||
        !form ||
        !nameField ||
        !emailField ||
        !phoneField ||
        !projectTypeField ||
        !timelineField ||
        !budgetField ||
        !briefField ||
        !measurementsField ||
        !plansField ||
        !feedback ||
        !submitBtn
    ) {
        return;
    }

    const defaultSubmitLabel = submitBtn.textContent;

    function setFeedback(message, state) {
        feedback.textContent = message || "";
        if (state) {
            feedback.dataset.state = state;
        } else {
            delete feedback.dataset.state;
        }
    }

    function setSubmitting(isSubmitting) {
        submitBtn.disabled = isSubmitting;
        submitBtn.textContent = isSubmitting ? "Saving Inquiry..." : defaultSubmitLabel;
    }

    function collectAttachments() {
        const buckets = [
            { input: measurementsField, category: "measurements" },
            { input: plansField, category: "plans" },
        ];

        return buckets.flatMap(({ input, category }) =>
            Array.from(input.files || []).map((file) => ({ file, category }))
        );
    }

    function validateAttachments(attachments) {
        if (attachments.length > maxFilesPerInquiry) {
            return `Please upload no more than ${maxFilesPerInquiry} files per inquiry.`;
        }

        for (const entry of attachments) {
            if (entry.file.size > maxFileSizeMb * 1024 * 1024) {
                return `${entry.file.name} is larger than ${maxFileSizeMb} MB.`;
            }
        }

        return "";
    }

    function openChatbot() {
        panel.hidden = false;
        panel.setAttribute("aria-hidden", "false");
        backdrop.hidden = false;
        document.body.style.overflow = "hidden";
        nameField.focus();
    }

    function closeChatbot() {
        panel.hidden = true;
        panel.setAttribute("aria-hidden", "true");
        backdrop.hidden = true;
        document.body.style.overflow = "";
    }

    openBtn.addEventListener("click", openChatbot);
    closeBtn.addEventListener("click", closeChatbot);
    backdrop.addEventListener("click", closeChatbot);

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            closeChatbot();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            setFeedback("Please complete the required fields before sending.", "error");
            if (typeof form.reportValidity === "function") {
                form.reportValidity();
            }
            return;
        }

        if (!uploadConfig.webAppUrl || !uploadConfig.publicToken) {
            setFeedback("Upload is not configured yet. Add your Apps Script URL and public token in index.html.", "error");
            return;
        }

        if (!window.GASUploader || typeof window.GASUploader.submitPayload !== "function") {
            setFeedback("Uploader library is missing from the page.", "error");
            return;
        }

        const attachments = collectAttachments();
        const attachmentError = validateAttachments(attachments);
        if (attachmentError) {
            setFeedback(attachmentError, "error");
            return;
        }

        const payload = {
            action: "submitInquiry",
            token: uploadConfig.publicToken,
            form: {
                name: nameField.value.trim(),
                email: emailField.value.trim(),
                phone: phoneField.value.trim(),
                projectType: projectTypeField.value.trim(),
                timeline: timelineField.value.trim(),
                budget: budgetField.value.trim(),
                brief: briefField.value.trim(),
            },
        };

        try {
            setSubmitting(true);
            setFeedback("Saving your inquiry, files, and XML package...", "");

            const result = await window.GASUploader.submitPayload({
                webAppUrl: uploadConfig.webAppUrl,
                timeoutMs: 45000,
                payload,
                attachments,
            });

            if (!result.success) {
                throw new Error(result.message || "Could not save the inquiry.");
            }

            form.reset();
            setFeedback("Inquiry saved successfully. Your project folder and submission XML are ready.", "success");
            window.setTimeout(closeChatbot, 1200);
        } catch (error) {
            const rawMessage = error && error.message ? error.message : "Upload failed.";
            if (rawMessage.toLowerCase().includes("timed out")) {
                setFeedback(
                    "Upload timed out. Check Apps Script deployment access (Anyone), confirm latest version is deployed, then try again.",
                    "error"
                );
            } else {
                setFeedback(rawMessage, "error");
            }
        } finally {
            setSubmitting(false);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setFooterYear();
    initNav();
    initSmoothScroll();
    initContactForm();
    loadGroups();
    loadModelsGrid();
});
