/**
 * Three.js viewer integrated with models.json
 * - Reads "id" from query string
 * - Loads content/models.json
 * - Finds the selected model and loads its .glb
 * - Updates title/description/tags/file path
 * - Provides clipping planes, wireframe toggle, group visibility
 */

const MODELS_URL = "content/models.json";

const dom = {
  title: document.getElementById("modelTitle"),
  description: document.getElementById("modelDescription"),
  tags: document.getElementById("modelTags"),
  filePath: document.getElementById("modelFilePath"),
  related: document.getElementById("relatedModels"),

  viewerContainer: document.getElementById("viewer-container"),
  canvas: document.getElementById("model-canvas") || document.getElementById("model-viewer"),
  loading: document.getElementById("loading"),
  error: document.getElementById("error"),
  groupControls: document.getElementById("group-controls"),
  groupToggles: document.getElementById("group-toggles"),
};

// ========== Helper: get model id from URL ==========

function getModelIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function loadModelsJson() {
  const res = await fetch(MODELS_URL);
  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function showError(message) {
  if (!dom.error) return;
  dom.error.style.display = "block";
  dom.error.textContent = message;
}

function hideLoading() {
  if (dom.loading) {
    dom.loading.style.display = "none";
  }
}

// ========== Three.js globals ==========

let scene, camera, renderer, controls;
let model = null;
let materials = [];
let isWireframe = false;
let gui = null;
const clippingPlanes = [
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
  new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
];
const modelSize = new THREE.Vector3();
const modelCenter = new THREE.Vector3();
let groupControlsMap = {};

// ========== Three.js functions ==========

function updateClipping() {
  materials.forEach((mat) => {
    mat.clippingPlanes = clippingPlanes;
    mat.needsUpdate = true;
  });
}

function toggleGroupControls() {
  if (!dom.groupControls) return;
  dom.groupControls.style.display =
    dom.groupControls.style.display === "none" ? "block" : "none";
}

function setupGroupControls() {
  if (!dom.groupToggles || !model) return;
  dom.groupToggles.innerHTML = "";
  groupControlsMap = {};

  model.traverse((child) => {
    if (child.isGroup || (child.isMesh && child.parent === model)) {
      const groupName = child.name || "Unnamed Group";
      groupControlsMap[groupName] = child;

      const div = document.createElement("div");
      div.className = "group-toggle";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = child.visible;
      checkbox.id = "toggle-" + groupName.replace(/\s+/g, "-");

      checkbox.addEventListener("change", (e) => {
        child.visible = e.target.checked;
      });

      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.textContent = groupName;

      div.appendChild(checkbox);
      div.appendChild(label);
      dom.groupToggles.appendChild(div);
    }
  });

  dom.groupControls.style.display = "block";
}

function loadModel(modelPath) {
  const loader = new THREE.GLTFLoader();

  loader.load(
    modelPath,
    function (gltf) {
      // Dispose old model
      if (model) {
        scene.remove(model);
        model.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }

      model = gltf.scene;
      materials = [];

      model.traverse((child) => {
        if (child.isMesh) {
          if (Array.isArray(child.material)) {
            materials.push(...child.material);
          } else {
            materials.push(child.material);
          }

          child.material = new THREE.MeshStandardMaterial({
            ...child.material,
            metalness: 0.2,
            roughness: 0.4,
            side: THREE.DoubleSide,
            clippingPlanes: clippingPlanes,
          });

          const edges = new THREE.EdgesGeometry(child.geometry, 15);
          const edgeMaterial = new THREE.LineBasicMaterial({
            color: 0x000000,
            linewidth: 1.5,
          });
          const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
          child.add(edgeLines);
        }
      });

      scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      box.getCenter(modelCenter);
      box.getSize(modelSize);

      model.position.sub(modelCenter);


// Adjust clipping GUI ranges if present
if (gui && gui.__folders) {
  const xFolder = gui.__folders["X Clipping"];
  const yFolder = gui.__folders["Y Clipping"];
  const zFolder = gui.__folders["Z Clipping"];

  if (xFolder && yFolder && zFolder) {
    // X
    const xCtrl = xFolder.__controllers[0];
    const xMin = -modelSize.x / 2;
    const xMax =  modelSize.x / 2;
    xCtrl.min(xMin).max(xMax).step(modelSize.x / 100);
    // start at max (plane outside object)
    clippingPlanes[0].constant = xMax;
    xCtrl.setValue(xMax);

    // Y
    const yCtrl = yFolder.__controllers[0];
    const yMin = -modelSize.y / 2;
    const yMax =  modelSize.y / 2;
    yCtrl.min(yMin).max(yMax).step(modelSize.y / 100);
    clippingPlanes[1].constant = yMax;
    yCtrl.setValue(yMax);

    // Z
    const zCtrl = zFolder.__controllers[0];
    const zMin = -modelSize.z / 2;
    const zMax =  modelSize.z / 2;
    zCtrl.min(zMin).max(zMax).step(modelSize.z / 100);
    clippingPlanes[2].constant = zMax;
    zCtrl.setValue(zMax);

    // Apply clipping update
    updateClipping();
  }
}


      setupGroupControls();

      const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
      cameraZ *= 1.3;

      camera.position.set(-cameraZ, cameraZ * 0.7, -cameraZ);
      controls.target.copy(new THREE.Vector3(0, modelSize.y * 0.2, 0));
      controls.update();

      hideLoading();
    },
    function (xhr) {
      if (dom.loading && xhr.total) {
        const percent = ((xhr.loaded / xhr.total) * 100).toFixed(1);
        dom.loading.textContent = `Loading: ${percent}%`;
      }
    },
    function (error) {
      console.error("Error loading model:", error);
      if (dom.loading) dom.loading.textContent = "Error loading model";
      showError("Error loading model: " + (error.message || modelPath));
    }
  );
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  renderer.render(scene, camera);
}

function onWindowResize() {
  if (!dom.viewerContainer || !camera || !renderer) return;
  const width = dom.viewerContainer.clientWidth;
  const height = dom.viewerContainer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function toggleWireframe() {
  isWireframe = !isWireframe;
  materials.forEach((mat) => {
    mat.wireframe = isWireframe;
  });
}

function resetCamera() {
  if (!model) return;
  const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.3;
  camera.position.set(-cameraZ, cameraZ * 0.7, -cameraZ);
  controls.target.copy(new THREE.Vector3(0, modelSize.y * 0.2, 0));
  controls.update();
}

// ========== Main init ==========

async function init() {
  const modelId = getModelIdFromUrl();
  if (!modelId) {
    showError("No model id specified in URL (?id=...)");
    hideLoading();
    return;
  }

  try {
    const models = await loadModelsJson();
    const currentModel = models.find((m) => m.id === modelId);

    if (!currentModel) {
      showError(`Model with id "${modelId}" not found in models.json`);
      hideLoading();
      return;
    }

    // Bind meta info
    if (dom.title) dom.title.textContent = currentModel.name || currentModel.id;
    if (dom.description) dom.description.textContent = currentModel.description || "";
    if (dom.filePath) dom.filePath.textContent = currentModel.file || "";
    if (dom.tags) {
      dom.tags.innerHTML = "";
      (currentModel.tags || []).forEach((tag) => {
        const pill = document.createElement("span");
        pill.className = "model-tag-pill";
        pill.textContent = tag;
        dom.tags.appendChild(pill);
      });
    }

    // Build Three.js scene
    if (!dom.viewerContainer || !dom.canvas) {
      showError("Viewer container or canvas not found in HTML.");
      hideLoading();
      return;
    }

    const width = dom.viewerContainer.clientWidth;
    const height = dom.viewerContainer.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 1000);
    camera.position.set(-1, 1, -1);

    renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    renderer.localClippingEnabled = true;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;

    gui = new dat.GUI({ autoPlace: true });
    const xFolder = gui.addFolder("X Clipping");
    xFolder
      .add(clippingPlanes[0], "constant", -10, 10)
      .step(0.1)
      .name("Position")
      .onChange(updateClipping);
    xFolder
      .add({ flip: false }, "flip")
      .name("Flip Direction")
      .onChange((val) => {
        clippingPlanes[0].normal.set(val ? 1 : -1, 0, 0);
        updateClipping();
      });

    const yFolder = gui.addFolder("Y Clipping");
    yFolder
      .add(clippingPlanes[1], "constant", -10, 10)
      .step(0.1)
      .name("Position")
      .onChange(updateClipping);
    yFolder
      .add({ flip: false }, "flip")
      .name("Flip Direction")
      .onChange((val) => {
        clippingPlanes[1].normal.set(0, val ? 1 : -1, 0);
        updateClipping();
      });

    const zFolder = gui.addFolder("Z Clipping");
    zFolder
      .add(clippingPlanes[2], "constant", -10, 10)
      .step(0.1)
      .name("Position")
      .onChange(updateClipping);
    zFolder
      .add({ flip: false }, "flip")
      .name("Flip Direction")
      .onChange((val) => {
        clippingPlanes[2].normal.set(0, 0, val ? 1 : -1);
        updateClipping();
      });

    xFolder.open();
    yFolder.open();
    zFolder.open();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-1, -0.5, -1);
    scene.add(backLight);

    // Load model from models.json file path
    loadModel(currentModel.file);

    window.addEventListener("resize", onWindowResize);
    animate();
  } catch (err) {
    console.error(err);
    showError("Error loading model data: " + err.message);
    hideLoading();
  }
}

// Make control functions available to HTML buttons
//window.toggleWireframe = toggleWireframe;
window.resetCamera = resetCamera;
window.toggleGroupControls = toggleGroupControls;

// Initialize after DOM loaded
window.addEventListener("load", init);
