// ====================================
// GLTF Viewer 2.0 - Three.js Logic
// ====================================

let scene, camera, renderer, controls, model;
let ambientLight, directionalLight;
let modelGroups = [];
let initialCameraPosition = { x: 0, y: 2, z: 5 };
let edgesVisible = true;
let selectedGroups = new Set();
let isolationActive = false;
let cameraTween = null;

function getErrorMessage(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;
    return String(error.message || error.reason || error);
}

function isImageDecodeError(error) {
    const msg = getErrorMessage(error).toLowerCase();
    return (
        msg.includes('image could not be decoded') ||
        msg.includes('the source image could not be decoded') ||
        (msg.includes('image') && msg.includes('decode')) ||
        msg === '[object event]'
    );
}

function isLikelyTextureEventError(error) {
    if (!error || typeof error !== 'object') return false;
    return String(error.type || '').toLowerCase() === 'error';
}

function patchImageLoaderWithPlaceholder() {
    const originalImageLoaderLoad = THREE.ImageLoader.prototype.load;

    THREE.ImageLoader.prototype.load = function patchedImageLoader(url, onLoad, onProgress, onError) {
        return originalImageLoaderLoad.call(
            this,
            url,
            onLoad,
            onProgress,
            function textureErrorHandler(error) {
                console.warn('Texture decode failed. Using placeholder texture for:', url);

                // Use a tiny neutral placeholder image so model geometry can still render.
                const placeholder = document.createElement('canvas');
                placeholder.width = 2;
                placeholder.height = 2;
                const ctx = placeholder.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#cfcfcf';
                    ctx.fillRect(0, 0, 2, 2);
                }

                if (typeof onLoad === 'function') {
                    onLoad(placeholder);
                }

                if (typeof onError === 'function') {
                    onError(error);
                }
            }
        );
    };

    return function restoreImageLoader() {
        THREE.ImageLoader.prototype.load = originalImageLoaderLoad;
    };
}

// ====================================
// Initialize Three.js Scene
// ====================================
function init() {
    const canvas = document.getElementById('model-canvas');
    const container = document.getElementById('viewer-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Camera
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Lighting
    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Additional fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI;

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();
}

// ====================================
// Animation Loop
// ====================================
function animate() {
    requestAnimationFrame(animate);

    // Process camera tween
    if (cameraTween) {
        const elapsed = performance.now() - cameraTween.startTime;
        const t = Math.min(elapsed / cameraTween.duration, 1);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
        camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, ease);
        controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, ease);
        if (t >= 1) cameraTween = null;
    }

    controls.update();
    renderer.render(scene, camera);
}

// ====================================
// Window Resize Handler
// ====================================
function onWindowResize() {
    const container = document.getElementById('viewer-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ====================================
// Load GLTF Model
// ====================================
function loadModel(modelPath) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');

    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';

    function finishLoadedModel(gltf) {
        model = gltf.scene;

        // Calculate bounding box and center model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center the model
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        // Start model rotated 90 degrees for initial view
        model.rotation.y = Math.PI / 2;

        // Add to scene
        scene.add(model);

        // Overlay edge lines on every mesh
        addEdgeLines(model);

        // Auto-scale camera based on model size
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5; // Add some padding
        camera.position.z = cameraZ;
        camera.updateProjectionMatrix();

        // Update controls target
        controls.target.set(0, 0, 0);
        controls.update();

        // Store initial camera position
        initialCameraPosition = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        };

        // Extract groups for visibility toggles
        extractGroups(model);

        // Hide loading
        loadingEl.style.display = 'none';

        console.log('Model loaded successfully:', modelPath);
    }

    function attemptLoad(disableImageBitmap, tolerateTextureErrors) {
        const previousCreateImageBitmap = window.createImageBitmap;
        const restoreImageLoader = tolerateTextureErrors ? patchImageLoaderWithPlaceholder() : null;

        if (disableImageBitmap && typeof window.createImageBitmap !== 'undefined') {
            window.createImageBitmap = undefined;
        }

        const loader = new THREE.GLTFLoader();
        loader.load(
            modelPath,
            function (gltf) {
                if (restoreImageLoader) {
                    restoreImageLoader();
                }
                if (disableImageBitmap) {
                    window.createImageBitmap = previousCreateImageBitmap;
                }
                finishLoadedModel(gltf);
            },
            function (xhr) {
                const percent = xhr.total ? (xhr.loaded / xhr.total * 100).toFixed(0) : '...';
                loadingEl.textContent = disableImageBitmap
                    ? `Loading 3D model (compatibility mode)... ${percent}%`
                    : `Loading 3D model... ${percent}%`;
            },
            function (error) {
                if (restoreImageLoader) {
                    restoreImageLoader();
                }
                if (disableImageBitmap) {
                    window.createImageBitmap = previousCreateImageBitmap;
                }

                if (!disableImageBitmap && isImageDecodeError(error)) {
                    console.warn('Image decode failed. Retrying with compatibility texture loader.');
                    loadingEl.textContent = 'Texture decode issue detected. Retrying...';
                    attemptLoad(true, false);
                    return;
                }

                if (disableImageBitmap && !tolerateTextureErrors && (isImageDecodeError(error) || isLikelyTextureEventError(error))) {
                    console.warn('Compatibility load still failed. Retrying with placeholder textures.');
                    loadingEl.textContent = 'Some textures are not decodable. Loading with fallback textures...';
                    attemptLoad(true, true);
                    return;
                }

                console.error('Error loading model:', error);
                loadingEl.style.display = 'none';
                errorEl.style.display = 'block';
                errorEl.textContent = `Error loading model: ${getErrorMessage(error) || 'Unknown error'}. Please check the file path and format.`;
            }
        );
    }

    attemptLoad(false, false);
}

// ====================================
// Extract Groups from Model
// ====================================
function extractGroups(object) {
    modelGroups = [];
    selectedGroups = new Set();
    isolationActive = false;
    var btn = document.getElementById('btn-isolate');
    if (btn) { btn.textContent = 'Isolate'; btn.classList.remove('active'); }

    const groupTogglesContainer = document.getElementById('group-toggles');
    groupTogglesContainer.innerHTML = '';

    object.traverse((child) => {
        if (child.isMesh && child.parent && child.parent.name) {
            const groupName = child.parent.name;
            if (!modelGroups.find(g => g.name === groupName)) {
                modelGroups.push({
                    name: groupName,
                    object: child.parent,
                    visible: true
                });

                // Create toggle row
                const toggleDiv = document.createElement('div');
                toggleDiv.className = 'group-toggle';
                toggleDiv.dataset.group = groupName;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `group-${groupName}`;
                checkbox.checked = true;
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    toggleGroupVisibility(groupName, e.target.checked);
                });

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = groupName || 'Unnamed Group';
                // Click label to select; shift-click for multi-select
                label.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleGroupSelection(groupName, e.shiftKey);
                });

                toggleDiv.appendChild(checkbox);
                toggleDiv.appendChild(label);
                groupTogglesContainer.appendChild(toggleDiv);
            }
        }
    });

    // Show group controls if we have groups
    if (modelGroups.length > 0) {
        console.log(`Found ${modelGroups.length} groups in model`);
    }
}

// ====================================
// Toggle Group Visibility
// ====================================
function toggleGroupVisibility(groupName, visible) {
    const group = modelGroups.find(g => g.name === groupName);
    if (group) {
        group.object.visible = visible;
        group.visible = visible;
    }
}

// ====================================
// Toggle Group Controls Panel
// ====================================
function toggleGroupControls() {
    const panel = document.getElementById('group-controls');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ====================================
// Reset Camera to Initial Position
// ====================================
function resetCamera() {
    startCameraTween(
        new THREE.Vector3(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z),
        new THREE.Vector3(0, 0, 0)
    );
}

// ====================================
// Camera Tween Helper
// ====================================
function startCameraTween(toPos, toTarget, duration = 700) {
    cameraTween = {
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPos: toPos.clone(),
        toTarget: toTarget.clone(),
        duration: duration,
        startTime: performance.now()
    };
}

// ====================================
// Toast Notification
// ====================================
function showToast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('visible'); }, 2800);
}

// ====================================
// Group Selection
// ====================================
function toggleGroupSelection(groupName, addToSelection) {
    if (addToSelection) {
        if (selectedGroups.has(groupName)) {
            selectedGroups.delete(groupName);
        } else {
            selectedGroups.add(groupName);
        }
    } else {
        if (selectedGroups.has(groupName) && selectedGroups.size === 1) {
            selectedGroups.clear();
        } else {
            selectedGroups.clear();
            selectedGroups.add(groupName);
        }
    }
    updateSelectionUI();
}

function updateSelectionUI() {
    document.querySelectorAll('.group-toggle').forEach(function (div) {
        if (selectedGroups.has(div.dataset.group)) {
            div.classList.add('selected');
        } else {
            div.classList.remove('selected');
        }
    });
}

// ====================================
// Focus Camera on Selected Parts
// ====================================
function focusOnSelected() {
    if (selectedGroups.size === 0) {
        showToast('Select a part first to focus on it');
        return;
    }

    var box = new THREE.Box3();
    selectedGroups.forEach(function (name) {
        var group = modelGroups.find(function (g) { return g.name === name; });
        if (group && group.object) {
            box.union(new THREE.Box3().setFromObject(group.object));
        }
    });

    if (box.isEmpty()) return;

    var center = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);
    var fov = camera.fov * (Math.PI / 180);
    var distance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;

    var dir = camera.position.clone().sub(controls.target).normalize();
    var newPos = center.clone().add(dir.multiplyScalar(distance));

    startCameraTween(newPos, center);
}

// ====================================
// Isolate / Show All
// ====================================
function isolateSelected() {
    if (selectedGroups.size === 0) {
        showToast('Select a part first to isolate it');
        return;
    }

    modelGroups.forEach(function (group) {
        var shouldBeVisible = selectedGroups.has(group.name);
        group.object.visible = shouldBeVisible;
        group.visible = shouldBeVisible;
        var cb = document.getElementById('group-' + group.name);
        if (cb) cb.checked = shouldBeVisible;
    });

    isolationActive = true;
    var btn = document.getElementById('btn-isolate');
    if (btn) {
        btn.textContent = 'Show All';
        btn.classList.add('active');
    }
}

function toggleIsolation() {
    if (isolationActive) {
        modelGroups.forEach(function (group) {
            group.object.visible = true;
            group.visible = true;
            var cb = document.getElementById('group-' + group.name);
            if (cb) cb.checked = true;
        });
        isolationActive = false;
        var btn = document.getElementById('btn-isolate');
        if (btn) {
            btn.textContent = 'Isolate';
            btn.classList.remove('active');
        }
    } else {
        isolateSelected();
    }
}

// ====================================
// Add Edge Lines to Model
// ====================================
function addEdgeLines(object) {
    object.traverse((child) => {
        if (child.isMesh) {
            try {
                const edges = new THREE.EdgesGeometry(child.geometry, 20);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: 0x000000,
                    transparent: true,
                    opacity: 0.6,
                    linewidth: 1,
                });
                const lineSegments = new THREE.LineSegments(edges, lineMaterial);
                lineSegments.name = '__edges__';
                child.add(lineSegments);
            } catch (e) {
                // Skip meshes whose geometry can't produce edges
            }
        }
    });
}

// ====================================
// Toggle Edge Lines
// ====================================
function toggleEdges() {
    if (!model) return;
    edgesVisible = !edgesVisible;
    model.traverse((child) => {
        if (child.name === '__edges__') {
            child.visible = edgesVisible;
        }
    });
    const btn = document.getElementById('btn-edges');
    if (btn) btn.textContent = `Edges: ${edgesVisible ? 'On' : 'Off'}`;
}

// ====================================
// Toggle Wireframe Mode
// ====================================
function toggleWireframe() {
    if (model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.material.wireframe = !child.material.wireframe;
            }
        });
    }
}

// ====================================
// Get URL Parameters
// ====================================
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ====================================
// Load Project Data & Model Info
// ====================================
async function loadProjectData() {
    try {
        const modelPath = getUrlParam('model');
        const projectId = getUrlParam('id');

        if (!modelPath) {
            throw new Error('No model path specified in URL');
        }

        // Try to load project data from JSON
        const response = await fetch('assets/data/projects.json');
        if (response.ok) {
            const projects = await response.json();
            const project = projectId 
                ? projects.find(p => p.id === projectId)
                : projects.find(p => p.model_path === modelPath);

            if (project) {
                document.getElementById('modelTitle').textContent = project.title || 'Untitled Model';
                document.getElementById('modelDescription').textContent = project.description || '';
                
                // Load related models (exclude current)
                loadRelatedModels(projects.filter(p => p.id !== project.id && p.model_path));
            } else {
                // Fallback if project not found
                document.getElementById('modelTitle').textContent = '3D Model Viewer';
                document.getElementById('modelDescription').textContent = modelPath;
            }
        }

        // Load the 3D model
        loadModel(modelPath);

    } catch (error) {
        console.error('Error loading project data:', error);
        document.getElementById('modelTitle').textContent = 'Error Loading Model';
        document.getElementById('modelDescription').textContent = error.message;
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = error.message;
        document.getElementById('loading').style.display = 'none';
    }
}

// ====================================
// Load Related Models
// ====================================
function loadRelatedModels(projects) {
    const container = document.getElementById('relatedModels');
    if (!container || projects.length === 0) {
        return;
    }

    container.innerHTML = '';
    
    // Show max 3 related models
    projects.slice(0, 3).forEach(project => {
        const card = document.createElement('div');
        card.className = 'model-card';
        
        const img = project.image 
            ? `<img src="${project.image}" alt="${project.title}">`
            : `<div class="model-thumbnail-placeholder">No Image</div>`;
        
        card.innerHTML = `
            <a href="project-detail.html?model=${project.model_path}&id=${project.id}">
                ${img}
                <h3>${project.title}</h3>
            </a>
        `;
        
        container.appendChild(card);
    });
}

// ====================================
// Initialize on Page Load
// ====================================
window.addEventListener('DOMContentLoaded', () => {
    init();
    loadProjectData();
});
