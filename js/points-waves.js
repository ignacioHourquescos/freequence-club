import * as THREE from "three";

const VERTEX_SHADER = `
  attribute float scale;
  attribute float seed;
  attribute float phase;

  varying float vSeed;
  varying float vPhase;

  void main() {
    vSeed = seed;
    vPhase = phase;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = scale * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 pointColor;
  uniform float time;
  uniform float morphAmount;

  varying float vSeed;
  varying float vPhase;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    float tempo = 0.55 + vSeed * 1.15;
    float breath = time * tempo + vPhase;

    // Círculo con contorno que apenas ondula
    float wobble =
      0.025 * sin(angle * 2.0 + breath) +
      0.015 * sin(angle * 2.0 - breath * 0.7 + vPhase);

    float radius = 0.42 + wobble * morphAmount;
    if (r > radius) discard;

    float edge = smoothstep(radius, radius * 0.72, r);
    gl_FragColor = vec4(pointColor, edge);
  }
`;

/** Settings fijados desde el playground (vista club). */
export const CLOSING_WAVES = {
  color: "#2864f0",
  background: "#10141b",
  amountX: 70,
  amountY: 70,
  separation: 60,
  amplitude: 24,
  speed: 0.06,
  sizeScale: 6,
  freqX: 0.3,
  freqY: 0.5,
  cameraZ: 1200,
  followPointer: true,
  morphAmount: 0,
  personalAmp: 10,
  highlightCenter: true,
  highlightColor: "#ffffff",
  // Optional grid indices for the white “yo” point (defaults to grid center)
  highlightIx: null,
  highlightIy: null,
  // El doble del tamaño máximo de un punto de la grilla, para distinguirse
  centerScaleMul: 2,
  // Más recorrido vertical y más rápido que el resto, para leerse como “yo”
  // 3.2 * 2.5 = 150% más de salto arriba/abajo
  centerPersonalAmpMul: 8,
  centerTempoMul: 1.85,
};

const DEFAULTS = { ...CLOSING_WAVES };

function makeMaterial(color, morphAmount) {
  return new THREE.ShaderMaterial({
    uniforms: {
      pointColor: { value: new THREE.Color(color) },
      time: { value: 0 },
      morphAmount: { value: morphAmount },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/**
 * Waves de puntos del ejemplo oficial de Three.js, montable en un contenedor.
 * https://threejs.org/examples/webgl_points_waves.html
 */
export function createPointsWaves(container, options = {}) {
  if (!container) {
    throw new Error("createPointsWaves: hace falta un contenedor");
  }

  const params = { ...DEFAULTS, ...options };
  let amountX = params.amountX;
  let amountY = params.amountY;
  let separation = params.separation;

  let camera;
  let scene;
  let renderer;
  let particles;
  let selfPoint;
  let seeds;
  let phases;
  let centerIndex = -1;
  let count = 0;
  let mouseX = 0;
  let mouseY = 0;
  let running = true;
  let rafBound = false;

  const size = () => ({
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight,
  });

  const disposePoints = (points) => {
    if (!points) return;
    scene.remove(points);
    points.geometry.dispose();
    points.material.dispose();
  };

  const buildParticles = () => {
    disposePoints(particles);
    disposePoints(selfPoint);
    particles = null;
    selfPoint = null;

    const numParticles = amountX * amountY;
    const positions = new Float32Array(numParticles * 3);
    const scales = new Float32Array(numParticles);
    seeds = new Float32Array(numParticles);
    phases = new Float32Array(numParticles);

    const midX = Math.floor(amountX / 2);
    const midY = Math.floor(amountY / 2);
    const clampIndex = (value, max) =>
      Math.min(max - 1, Math.max(0, Math.floor(value)));
    const highlightIx =
      params.highlightIx == null ? midX : clampIndex(params.highlightIx, amountX);
    const highlightIy =
      params.highlightIy == null ? midY : clampIndex(params.highlightIy, amountY);
    centerIndex = -1;

    let i = 0;
    let j = 0;

    for (let ix = 0; ix < amountX; ix++) {
      for (let iy = 0; iy < amountY; iy++) {
        positions[i] = ix * separation - (amountX * separation) / 2;
        positions[i + 1] = 0;
        positions[i + 2] = iy * separation - (amountY * separation) / 2;
        scales[j] = 1;

        const n = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453;
        const seed = n - Math.floor(n);
        seeds[j] = seed;
        phases[j] = seed * Math.PI * 2;

        if (params.highlightCenter && ix === highlightIx && iy === highlightIy) {
          centerIndex = j;
        }

        i += 3;
        j++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));

    particles = new THREE.Points(
      geometry,
      makeMaterial(params.color, params.morphAmount)
    );
    scene.add(particles);

    if (params.highlightCenter && centerIndex >= 0) {
      const selfPositions = new Float32Array(3);
      const selfScales = new Float32Array([1]);
      const selfSeeds = new Float32Array([seeds[centerIndex]]);
      const selfPhases = new Float32Array([phases[centerIndex]]);
      const selfGeo = new THREE.BufferGeometry();
      selfGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(selfPositions, 3)
      );
      selfGeo.setAttribute("scale", new THREE.BufferAttribute(selfScales, 1));
      selfGeo.setAttribute("seed", new THREE.BufferAttribute(selfSeeds, 1));
      selfGeo.setAttribute("phase", new THREE.BufferAttribute(selfPhases, 1));

      selfPoint = new THREE.Points(
        selfGeo,
        makeMaterial(params.highlightColor, params.morphAmount)
      );
      selfPoint.renderOrder = 1;
      scene.add(selfPoint);
    }
  };

  const init = () => {
    const { width, height } = size();

    camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);
    camera.position.z = params.cameraZ;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(params.background);

    buildParticles();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    container.style.touchAction = "none";

    renderer.setAnimationLoop(animate);
    rafBound = true;
  };

  const onPointerMove = (event) => {
    if (event.isPrimary === false || !params.followPointer) return;
    const rect = container.getBoundingClientRect();
    mouseX = event.clientX - rect.left - rect.width / 2;
    mouseY = event.clientY - rect.top - rect.height / 2;
  };

  const onResize = () => {
    const { width, height } = size();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  const animate = () => {
    if (!running) return;

    if (params.followPointer) {
      camera.position.x += (mouseX - camera.position.x) * 0.05;
      camera.position.y += (-mouseY - camera.position.y) * 0.05;
    } else {
      camera.position.x += (0 - camera.position.x) * 0.05;
      camera.position.y += (0 - camera.position.y) * 0.05;
    }

    camera.lookAt(scene.position);

    const positions = particles.geometry.attributes.position.array;
    const scales = particles.geometry.attributes.scale.array;
    let i = 0;
    let j = 0;
    // Tamaño máximo posible de un punto de la grilla (sin pulso que lo achique)
    const maxPointScale =
      params.sizeScale * 4 + params.sizeScale * 0.36;
    const centerScale = maxPointScale * params.centerScaleMul;

    for (let ix = 0; ix < amountX; ix++) {
      for (let iy = 0; iy < amountY; iy++) {
        const shared =
          Math.sin((ix + count) * params.freqX) * params.amplitude +
          Math.sin((iy + count) * params.freqY) * params.amplitude;

        const isCenter = j === centerIndex;
        const tempo =
          (0.55 + seeds[j] * 1.15) *
          (isCenter ? params.centerTempoMul : 1);
        const personalAmp =
          params.personalAmp * (isCenter ? params.centerPersonalAmpMul : 1);
        const personal =
          Math.sin(count * tempo + phases[j]) * personalAmp +
          Math.sin(count * (tempo * 1.7) + phases[j] * 1.3) *
            personalAmp *
            0.35;

        positions[i + 1] = shared + personal;

        if (isCenter) {
          // El blanco no pulsa de tamaño: siempre al máximo
          scales[j] = 0.001;
        } else {
          const sharedPulse =
            (Math.sin((ix + count) * params.freqX) + 1) * params.sizeScale +
            (Math.sin((iy + count) * params.freqY) + 1) * params.sizeScale;
          const personalPulse =
            (Math.sin(count * tempo + phases[j]) + 1) * params.sizeScale * 0.18;
          scales[j] = sharedPulse + personalPulse;
        }

        i += 3;
        j++;
      }
    }

    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.scale.needsUpdate = true;
    particles.material.uniforms.time.value = count;
    particles.material.uniforms.morphAmount.value = params.morphAmount;

    if (selfPoint && centerIndex >= 0) {
      const selfPos = selfPoint.geometry.attributes.position.array;
      const selfScale = selfPoint.geometry.attributes.scale.array;
      const ci = centerIndex * 3;
      selfPos[0] = positions[ci];
      selfPos[1] = positions[ci + 1];
      selfPos[2] = positions[ci + 2];
      selfScale[0] = centerScale;
      selfPoint.geometry.attributes.position.needsUpdate = true;
      selfPoint.geometry.attributes.scale.needsUpdate = true;
      selfPoint.material.uniforms.time.value = count;
      selfPoint.material.uniforms.morphAmount.value = params.morphAmount;
    }

    renderer.render(scene, camera);
    count += params.speed;
  };

  init();
  container.addEventListener("pointermove", onPointerMove);
  window.addEventListener("resize", onResize);

  return {
    getParams() {
      return { ...params, amountX, amountY, separation };
    },
    setParams(next = {}) {
      const needsRebuild =
        (next.amountX != null && next.amountX !== amountX) ||
        (next.amountY != null && next.amountY !== amountY) ||
        (next.separation != null && next.separation !== separation) ||
        (next.highlightCenter != null &&
          next.highlightCenter !== params.highlightCenter) ||
        (next.highlightIx != null && next.highlightIx !== params.highlightIx) ||
        (next.highlightIy != null && next.highlightIy !== params.highlightIy);

      Object.assign(params, next);

      if (next.amountX != null) amountX = next.amountX;
      if (next.amountY != null) amountY = next.amountY;
      if (next.separation != null) separation = next.separation;

      if (next.color != null && particles) {
        particles.material.uniforms.pointColor.value.set(params.color);
      }
      if (next.highlightColor != null && selfPoint) {
        selfPoint.material.uniforms.pointColor.value.set(params.highlightColor);
      }
      if (next.background != null) {
        scene.background = new THREE.Color(params.background);
      }
      if (next.cameraZ != null) {
        camera.position.z = params.cameraZ;
      }
      if (next.morphAmount != null) {
        particles.material.uniforms.morphAmount.value = params.morphAmount;
        if (selfPoint) {
          selfPoint.material.uniforms.morphAmount.value = params.morphAmount;
        }
      }
      if (needsRebuild) {
        buildParticles();
      }
    },
    pause() {
      running = false;
      if (renderer) renderer.setAnimationLoop(null);
    },
    resume() {
      if (!running) {
        running = true;
        if (renderer) renderer.setAnimationLoop(animate);
      }
    },
    destroy() {
      running = false;
      if (rafBound && renderer) renderer.setAnimationLoop(null);
      container.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      disposePoints(particles);
      disposePoints(selfPoint);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    },
  };
}
