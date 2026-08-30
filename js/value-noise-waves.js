import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const VERTEX_SHADER = `
  #define PI 3.14159265359

  uniform float u_time;
  uniform float u_pointsize;
  uniform float u_noise_amp_1;
  uniform float u_noise_freq_1;
  uniform float u_spd_modifier_1;
  uniform float u_noise_amp_2;
  uniform float u_noise_freq_2;
  uniform float u_spd_modifier_2;

  // 2D Random
  float random (in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // 2D Noise based on Morgan McGuire @morgan3d
  // https://www.shadertoy.com/view/4dS3Wd
  float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
      (c - a) * u.y * (1.0 - u.x) +
      (d - b) * u.x * u.y;
  }

  mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  void main() {
    gl_PointSize = u_pointsize;

    vec3 pos = position;
    pos.z += noise(pos.xy * u_noise_freq_1 + u_time * u_spd_modifier_1) * u_noise_amp_1;
    pos.z += noise(rotate2d(PI / 4.0) * pos.yx * u_noise_freq_2 - u_time * u_spd_modifier_2 * 0.6) * u_noise_amp_2;

    vec4 mvm = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvm;
  }
`;

const FRAGMENT_SHADER = `
  #ifdef GL_ES
  precision mediump float;
  #endif

  uniform vec2 u_resolution;
  uniform vec3 u_tint;
  uniform float u_tint_amount;

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec3 original = vec3(0.0, st);
    vec3 tinted = mix(original, u_tint * (0.35 + 0.65 * st.y), 0.72);
    gl_FragColor = vec4(mix(original, tinted, u_tint_amount), 1.0);
  }
`;

const DEFAULTS = {
  background: 0x0d1214,
  pointSize: 2,
  segments: 128,
  cameraZ: 4.5,
  autoRotate: true,
  autoRotateSpeed: 2,
  wave1Freq: 3,
  wave1Amp: 0.2,
  wave1Speed: 1,
  wave2Freq: 2,
  wave2Amp: 0.3,
  wave2Speed: 0.8,
  tint: 0xffffff,
  tintAmount: 0,
};

/**
 * Ondas de puntos por value noise (dos capas en GPU).
 * Extraído de https://github.com/franky-adl/waves-value-noise
 * sin Parcel, dat.gui ni el boilerplate original.
 */
export function createValueNoiseWaves(container, options = {}) {
  if (!container) {
    throw new Error("createValueNoiseWaves: hace falta un contenedor");
  }

  const params = { ...DEFAULTS, ...options };
  let camera;
  let scene;
  let renderer;
  let controls;
  let mesh;
  let uniforms;
  let running = true;
  let rafBound = false;
  const clock = new THREE.Clock();

  const size = () => ({
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight,
  });

  const resolution = () => {
    const { width, height } = size();
    const dpr = Math.min(window.devicePixelRatio, 2);
    return new THREE.Vector2(width * dpr, height * dpr);
  };

  const buildMesh = () => {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    const geometry = new THREE.PlaneGeometry(4, 4, params.segments, params.segments);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    mesh = new THREE.Points(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.rotation.y = Math.PI / 4;
    scene.add(mesh);
  };

  const syncUniforms = () => {
    uniforms.u_pointsize.value = params.pointSize;
    uniforms.u_noise_freq_1.value = params.wave1Freq;
    uniforms.u_noise_amp_1.value = params.wave1Amp;
    uniforms.u_spd_modifier_1.value = params.wave1Speed;
    uniforms.u_noise_freq_2.value = params.wave2Freq;
    uniforms.u_noise_amp_2.value = params.wave2Amp;
    uniforms.u_spd_modifier_2.value = params.wave2Speed;
    uniforms.u_tint.value.set(params.tint);
    uniforms.u_tint_amount.value = params.tintAmount;
    uniforms.u_resolution.value.copy(resolution());
  };

  const init = () => {
    const { width, height } = size();

    camera = new THREE.PerspectiveCamera(60, width / height, 1, 100);
    camera.position.set(0, 0, params.cameraZ);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(params.background);

    uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: resolution() },
      u_pointsize: { value: params.pointSize },
      u_noise_freq_1: { value: params.wave1Freq },
      u_noise_amp_1: { value: params.wave1Amp },
      u_spd_modifier_1: { value: params.wave1Speed },
      u_noise_freq_2: { value: params.wave2Freq },
      u_noise_amp_2: { value: params.wave2Amp },
      u_spd_modifier_2: { value: params.wave2Speed },
      u_tint: { value: new THREE.Color(params.tint) },
      u_tint_amount: { value: params.tintAmount },
    };

    buildMesh();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = params.autoRotate;
    controls.autoRotateSpeed = params.autoRotateSpeed;

    renderer.setAnimationLoop(animate);
    rafBound = true;
  };

  const onResize = () => {
    const { width, height } = size();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    uniforms.u_resolution.value.copy(resolution());
  };

  const animate = () => {
    if (!running) return;
    uniforms.u_time.value = clock.getElapsedTime();
    controls.autoRotate = params.autoRotate;
    controls.autoRotateSpeed = params.autoRotateSpeed;
    controls.update();
    renderer.render(scene, camera);
  };

  init();
  window.addEventListener("resize", onResize);

  return {
    getParams() {
      return { ...params };
    },
    setParams(next = {}) {
      const needsRebuild =
        next.segments != null && next.segments !== params.segments;

      Object.assign(params, next);

      if (next.background != null) {
        scene.background = new THREE.Color(params.background);
      }
      if (next.cameraZ != null) {
        camera.position.z = params.cameraZ;
      }

      syncUniforms();

      if (needsRebuild) {
        buildMesh();
      }
    },
    destroy() {
      running = false;
      if (rafBound && renderer) renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      if (controls) controls.dispose();
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    },
  };
}
