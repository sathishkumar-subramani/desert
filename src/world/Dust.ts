import * as THREE from 'three'
import { hash } from '../core/math'
import { palette } from './palette'

/**
 * Wind-blown sand. The grains live in a box that wraps around the camera, so
 * a few thousand points cover the whole journey. All motion is in the shader.
 */
export class Dust {
  points: THREE.Points
  private mat: THREE.ShaderMaterial

  constructor(count = 2600) {
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos.set([hash(i), hash(i + 0.33), hash(i + 0.66)], i * 3)
      seed[i] = hash(i * 3.1)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, 
      uniforms: { uTime: { value: 0 }, uStorm: { value: 0 }, uColor: { value: palette.haze } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime, uStorm; varying float vA;
        const vec3 BOX = vec3(44.0, 14.0, 44.0);
        void main() {
          vec3 wind = vec3(1.6, 0.05, 0.7) * (1.0 + uStorm * 7.0) * (0.5 + aSeed);
          vec3 p = position * BOX + wind * uTime;
          p.y += sin(uTime * (0.4 + aSeed) + aSeed * 40.0) * 0.5;
          p = mod(p - cameraPosition + BOX * 0.5, BOX) - BOX * 0.5 + cameraPosition; // wrap around camera
          p.y = max(p.y, 0.05);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (10.0 + aSeed * 26.0) * (1.0 + uStorm) / -mv.z;
          vA = smoothstep(22.0, 12.0, -mv.z) * smoothstep(0.3, 2.0, -mv.z) * (0.25 + uStorm * 0.5);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vA);
        }`,
    })
    this.points = new THREE.Points(geo, this.mat)
    this.points.frustumCulled = false
  }

  /** storm: 0 = calm air, 1 = the sandstorm between sections. */
  update(time: number, storm: number) {
    this.mat.uniforms.uTime.value = time
    this.mat.uniforms.uStorm.value = storm
  }
}
