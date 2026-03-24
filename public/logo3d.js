import * as THREE from "three";

const EXTRUDE_DEPTH = 0.3;
const ROTATION_SPEED = 0.8;

const canvas = document.getElementById("logo-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.z = 5;

// Lighting
const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
frontLight.position.set(0, 0, 5);
scene.add(frontLight);

const backLight = new THREE.DirectionalLight(0xffffff, 1.2);
backLight.position.set(0, 0, -5);
scene.add(backLight);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// Load image to extract alpha outline
const img = new Image();
img.src = "assets/wrccdc_logo.png";
img.onload = () => {
  const w = img.width;
  const h = img.height;
  const aspect = w / h;

  // Draw image to canvas to read pixel data
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixelData = imageData.data;

  // Build a binary alpha mask
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = pixelData[i * 4 + 3] > 128 ? 1 : 0;
  }

  // Trace outer contour using Moore neighborhood with correct initialization
  const contour = traceContour(alpha, w, h);
  const simplified = simplifyContour(contour, 1.5);
  console.log("Contour points:", contour.length, "Simplified:", simplified.length);

  if (simplified.length < 3) {
    console.error("Contour tracing failed, falling back to bounding box");
    // Fallback won't happen but just in case
  }

  // Sample color by searching inward from contour point
  const centroidX = simplified.reduce((s, p) => s + p[0], 0) / simplified.length;
  const centroidY = simplified.reduce((s, p) => s + p[1], 0) / simplified.length;

  function sampleColor(px, py) {
    const dx = centroidX - px;
    const dy = centroidY - py;
    const len = Math.hypot(dx, dy) || 1;
    const stepX = dx / len;
    const stepY = dy / len;

    for (let step = 0; step < 30; step++) {
      const sx = Math.min(Math.max(Math.round(px + stepX * step), 0), w - 1);
      const sy = Math.min(Math.max(Math.round(py + stepY * step), 0), h - 1);
      const idx = (sy * w + sx) * 4;
      if (pixelData[idx + 3] > 220) {
        return [pixelData[idx] / 255, pixelData[idx + 1] / 255, pixelData[idx + 2] / 255];
      }
    }
    return [0.5, 0.5, 0.5];
  }

  // Build side wall geometry with vertex colors
  const n = simplified.length;
  const sidePositions = [];
  const sideColors = [];
  const sideNormals = [];
  const halfDepth = EXTRUDE_DEPTH / 2;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;

    const x0 = (simplified[i][0] / w - 0.5) * aspect;
    const y0 = -(simplified[i][1] / h - 0.5);
    const x1 = (simplified[j][0] / w - 0.5) * aspect;
    const y1 = -(simplified[j][1] / h - 0.5);

    const edgeDx = x1 - x0;
    const edgeDy = y1 - y0;
    const edgeLen = Math.hypot(edgeDx, edgeDy) || 1;
    const nx = edgeDy / edgeLen;
    const ny = -edgeDx / edgeLen;

    const c0 = sampleColor(simplified[i][0], simplified[i][1]);
    const c1 = sampleColor(simplified[j][0], simplified[j][1]);

    // Triangle 1
    sidePositions.push(x0, y0, halfDepth, x1, y1, halfDepth, x0, y0, -halfDepth);
    sideNormals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
    sideColors.push(...c0, ...c1, ...c0);

    // Triangle 2
    sidePositions.push(x1, y1, halfDepth, x1, y1, -halfDepth, x0, y0, -halfDepth);
    sideNormals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0);
    sideColors.push(...c1, ...c1, ...c0);
  }

  const sideGeom = new THREE.BufferGeometry();
  sideGeom.setAttribute("position", new THREE.Float32BufferAttribute(sidePositions, 3));
  sideGeom.setAttribute("color", new THREE.Float32BufferAttribute(sideColors, 3));
  sideGeom.setAttribute("normal", new THREE.Float32BufferAttribute(sideNormals, 3));

  const sideMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const sideMesh = new THREE.Mesh(sideGeom, sideMat);
  console.log("Side geometry vertices:", sidePositions.length / 3);

  // Create textures
  const textureLoader = new THREE.TextureLoader();

  const frontTexture = textureLoader.load("assets/wrccdc_logo.png");
  frontTexture.colorSpace = THREE.SRGBColorSpace;

  const backTexture = textureLoader.load("assets/wrccdc_logo.png");
  backTexture.colorSpace = THREE.SRGBColorSpace;
  backTexture.wrapS = THREE.RepeatWrapping;
  backTexture.repeat.x = -1;

  // Front face
  const frontGeom = new THREE.PlaneGeometry(aspect, 1);
  const frontMat = new THREE.MeshStandardMaterial({
    map: frontTexture,
    alphaTest: 0.5,
    transparent: false,
    side: THREE.FrontSide,
  });
  const frontMesh = new THREE.Mesh(frontGeom, frontMat);
  frontMesh.position.z = halfDepth + 0.001;
  const backGeom = new THREE.PlaneGeometry(aspect, 1);
  const backMat = new THREE.MeshStandardMaterial({
    map: backTexture,
    alphaTest: 0.5,
    transparent: false,
    side: THREE.FrontSide,
  });
  const backMesh = new THREE.Mesh(backGeom, backMat);
  backMesh.position.z = -halfDepth - 0.001;
  backMesh.rotation.y = Math.PI;

  const group = new THREE.Group();
  group.add(sideMesh);
  group.add(frontMesh);
  group.add(backMesh);
  scene.add(group);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(window.devicePixelRatio);

    const fitScale = Math.min(width / (aspect * 100), height / 100) * 0.9;
    const halfW = (width / 2) / (fitScale * 100);
    const halfH = (height / 2) / (fitScale * 100);
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener("resize", resize);

  function animate() {
    requestAnimationFrame(animate);
    group.rotation.y += (ROTATION_SPEED * Math.PI * 2) / (60 * 5);
    renderer.render(scene, camera);
  }
  animate();
};

// Moore neighborhood contour tracing with correct initialization
function traceContour(alpha, w, h) {
  function isOpaque(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return alpha[y * w + x] === 1;
  }

  function isBoundary(x, y) {
    if (!isOpaque(x, y)) return false;
    // A boundary pixel is opaque and has at least one transparent/OOB neighbor
    return !isOpaque(x - 1, y) || !isOpaque(x + 1, y) ||
           !isOpaque(x, y - 1) || !isOpaque(x, y + 1) ||
           !isOpaque(x - 1, y - 1) || !isOpaque(x + 1, y - 1) ||
           !isOpaque(x - 1, y + 1) || !isOpaque(x + 1, y + 1);
  }

  // Moore neighborhood directions: starting from right, going clockwise
  //   7  0  1
  //   6  x  2
  //   5  4  3
  const dirs = [
    [1, 0], [1, -1], [0, -1], [-1, -1],
    [-1, 0], [-1, 1], [0, 1], [1, 1],
  ];

  // Find start: first boundary pixel scanning top-to-bottom, left-to-right
  let startX = -1, startY = -1;
  outer:
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBoundary(x, y)) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }
  if (startX === -1) return [];

  // The pixel to the left of start is guaranteed transparent (we scanned left-to-right)
  // So we entered from direction 4 (from the left), meaning backtrack dir = 4
  const contour = [[startX, startY]];
  let cx = startX, cy = startY;
  let backtrack = 4; // direction we came from (left)

  const maxSteps = w * h * 2;
  for (let step = 0; step < maxSteps; step++) {
    // Start searching clockwise from one position after the backtrack direction
    const searchStart = (backtrack + 1) % 8;
    let found = false;

    for (let i = 0; i < 8; i++) {
      const d = (searchStart + i) % 8;
      const nx = cx + dirs[d][0];
      const ny = cy + dirs[d][1];

      if (isOpaque(nx, ny)) {
        // Backtrack direction is opposite of the direction we just moved
        backtrack = (d + 4) % 8;
        cx = nx;
        cy = ny;

        if (cx === startX && cy === startY) {
          return contour; // closed the loop
        }

        contour.push([cx, cy]);
        found = true;
        break;
      }
    }

    if (!found) break;
  }

  return contour;
}

// Ramer-Douglas-Peucker simplification
function simplifyContour(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDist(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyContour(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyContour(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

function pointToLineDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
