// ===== Model configuration =====================================
// Add your projects here. Each object = one model card in the UI.
// Update:
//   - title
//   - description
//   - type
//   - thumbnail (path to image)
//   - model (path to .gltf or .glb)

const MODELS = [
    {
        id: "model-1",
        title: "Sample Interior",
        description: "Minimalist living room concept with neutral palette.",
        type: "Interior",
        thumbnail: "assets/thumbnails/interior-sample.jpg",
        model: "assets/models/interior_sample.glb",
    },
    {
        id: "model-2",
        title: "Modern Facade",
        description: "Residential front elevation with clean lines.",
        type: "Architecture",
        thumbnail: "assets/thumbnails/facade-modern.jpg",
        model: "assets/models/facade_modern.glb",
    },
    {
        id: "model-3",
        title: "Furniture Piece",
        description: "Custom joinery / cabinet design prototype.",
        type: "Furniture",
        thumbnail: "assets/thumbnails/furniture-sample.jpg",
        model: "assets/models/furniture_sample.glb",
    },
];

// ===== DOM references ==========================================
const cardsContainer = document.getElementById("cards-container");
const viewerTitle = document.getElementById("viewer-title");
const viewerDescription = document.getElementById("viewer-description");
const viewerTag = document.getElementById("viewer-tag");
const viewerPlaceholder = document.getElementById("viewer-placeholder");
const resetCameraBtn = document.getElementById("reset-camera-btn");
const canvas = document.getElementById("viewer-canvas");

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// ===== Three.js core setup =====================================
let renderer, scene, camera;
let currentModel = null;
let controls;
let defaultCameraPosition = new THREE.Vector3(3, 2, 4);
let defaultTarget = new THREE.Vector3(0, 0, 0);
let resizeObserver;

// OrbitControls via CDN example (fallback: simple manual orbit)
let OrbitControls;
(function loadOrbitControls() {
    const script = document.createElement("script");
    script.src =
        "https://cdn.jsdelivr.net/npm/three@0.152/examples/js/controls/OrbitControls.js";
    script.onload = () => {
        OrbitControls = THREE.OrbitControls;
        initThree();
    };
    script.onerror = () => {
        console.warn(
            "OrbitControls failed to load. Basic mouse control only."
        );
        initThree();
    };
    document.head.appendChild(script);
})();

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.copy(defaultCameraPosition);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    resizeRendererToDisplaySize();

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xb0bec5, 0.9);
    hemiLight.position.set(0, 3, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(4, 6, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-3, 2, -4);
    scene.add(fillLight);

    // Ground / reference plane
    const groundGeo = new THREE.CircleGeometry(5, 64);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0xe5e7eb,
        roughness: 0.9,
        metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Controls if available
    if (OrbitControls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.copy(defaultTarget);
        controls.update();
    }

    // Animate
    renderer.setAnimationLoop(() => {
        if (controls) {
            controls.update();
        }
        renderer.render(scene, camera);
    });

    // Resize handling
    window.addEventListener("resize", resizeRendererToDisplaySize);
    resizeObserver = new ResizeObserver(resizeRendererToDisplaySize);
    resizeObserver.observe(canvas);
}

function resizeRendererToDisplaySize() {
    if (!renderer || !canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

// ===== Model loading ============================================
const loader = new THREE.GLTFLoader();

function clearCurrentModel() {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose());
                } else child.material.dispose();
            }
        });
        currentModel = null;
    }
}

function frameObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fitHeightDistance =
        maxDim / (2 * Math.atan((Math.PI * camera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.35;

    const direction = new THREE.Vector3(1, 0.8, 1).normalize();
    const newPosition = center.clone().add(direction.multiplyScalar(distance));

    camera.position.copy(newPosition);
    camera.lookAt(center);

    if (controls) {
        controls.target.copy(center);
        controls.update();
    }
}

function loadModel(modelConfig) {
    viewerPlaceholder.style.display = "none";
    viewerTag.textContent = "Loading…";

    clearCurrentModel();

    loader.load(
        modelConfig.model,
        (gltf) => {
            currentModel = gltf.scene;
            scene.add(currentModel);
            frameObject(currentModel);

            viewerTag.textContent = modelConfig.type || "Model";
        },
        undefined,
        (error) => {
            console.error("Error loading model:", error);
            viewerTag.textContent = "Error loading model";
        }
    );
}

// ===== UI: cards ===============================================
function createCard(model) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = model.id;

    card.innerHTML = `
        <div class="card-thumbnail-wrapper">
            <img src="${model.thumbnail}" alt="${model.title} thumbnail" class="card-thumbnail" />
            <div class="card-overlay-gradient"></div>
            <div class="card-badge">
                <span class="card-badge-dot"></span>
                <span>GLTF / GLB</span>
            </div>
        </div>
        <div class="card-content">
            <div class="card-title-row">
                <h3 class="card-title">${model.title}</h3>
                <span class="card-tag">${model.type}</span>
            </div>
            <p class="card-description">${model.description}</p>
        </div>
    `;

    card.addEventListener("click", () => {
        selectCard(model.id);
    });

    return card;
}

function renderCards() {
    cardsContainer.innerHTML = "";
    MODELS.forEach((model) => {
        const card = createCard(model);
        cardsContainer.appendChild(card);
    });
}

function selectCard(id) {
    const model = MODELS.find((m) => m.id === id);
    if (!model) return;

    // Active card styling
    document.querySelectorAll(".card").forEach((cardEl) => {
        cardEl.classList.toggle("active", cardEl.dataset.id === id);
    });

    // Viewer text
    viewerTitle.textContent = model.title;
    viewerDescription.textContent = model.description;
    viewerTag.textContent = "Loading…";

    // Reset camera button enabled
    resetCameraBtn.disabled = false;

    loadModel(model);
}

// Camera reset
resetCameraBtn.addEventListener("click", () => {
    if (!camera) return;
    camera.position.copy(defaultCameraPosition);
    if (controls) {
        controls.target.copy(defaultTarget);
        controls.update();
    } else {
        camera.lookAt(defaultTarget);
    }
});

// Initialize cards immediately
renderCards();

// Optionally: auto-select first model
// selectCard(MODELS[0].id);
``