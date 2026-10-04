import * as THREE from 'three'
import { hash } from '../core/math'
import { palette } from './palette'

/**
 * Sand-grain particle cloud that morphs between target shapes. The morph runs
 * in the vertex shader: two position attributes and one `uMix` uniform, so
 * the CPU does nothing per frame. Final version: targets sampled from models.
 */
export class Swarm {
  points: THREE.Points
  private mat: THREE.ShaderMaterial
  private shapes: Float32Array[]
  private index = 0
  private mix = 1

  constructor(position: [number, number, number], count = 14000) {
    this.shapes = [sphere(count), ring(count), cube(count)]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.shapes[0].slice(), 3))
    geo.setAttribute('aTarget', new THREE.BufferAttribute(this.shapes[0].slice(), 3))
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) seed[i] = hash(i * 1.7)
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6)

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMix: { value: 1 }, uTime: { value: 0 }, uSize: { value: 26 }, uColor: { value: palette.ink } },
      vertexShader: /* glsl */ `
        attribute vec3 aTarget; attribute float aSeed;
        uniform float uMix, uTime, uSize;
        void main() {
          // each grain leaves at its own moment, so the shape dissolves rather than slides
          float t = smoothstep(aSeed * 0.5, aSeed * 0.5 + 0.5, uMix);
          vec3 p = mix(position, aTarget, t);
          float burst = sin(t * 3.14159);
          p += vec3(sin(aSeed * 91.0 + uTime), cos(aSeed * 57.0 + uTime * 1.3), sin(aSeed * 33.0)) * (0.04 + burst * 0.9);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (0.5 + aSeed) / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        void main() {
          if (length(gl_PointCoord - 0.5) > 0.5) discard;
          gl_FragColor = vec4(uColor, 1.0);
        }`,
    })
    this.points = new THREE.Points(geo, this.mat)
    this.points.position.set(...position)
  }

  /** Start morphing to the next (dir = 1) or previous (dir = -1) shape. */
  next(dir = 1) {
    const geo = this.points.geometry
    const from = this.shapes[this.index]
    this.index = (this.index + dir + this.shapes.length) % this.shapes.length
    ;(geo.attributes.position as THREE.BufferAttribute).copyArray(from).needsUpdate = true
    ;(geo.attributes.aTarget as THREE.BufferAttribute).copyArray(this.shapes[this.index]).needsUpdate = true
    this.mix = 0
  }

  update(time: number, dt: number) {
    this.mix = Math.min(1, this.mix + dt / 1.6)
    this.mat.uniforms.uMix.value = this.mix
    this.mat.uniforms.uTime.value = time
    this.points.rotation.y = time * 0.2
  }
}

function sphere(n: number) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = hash(i) * 2 - 1, th = hash(i + 0.5) * Math.PI * 2, r = 2.2 * Math.cbrt(0.6 + hash(i + 0.25) * 0.4)
    const s = Math.sqrt(1 - u * u)
    a.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3)
  }
  return a
}
function ring(n: number) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const th = hash(i) * Math.PI * 2, ph = hash(i + 0.5) * Math.PI * 2, r = 0.5 * Math.sqrt(hash(i + 0.25))
    a.set([(2.2 + r * Math.cos(ph)) * Math.cos(th), (2.2 + r * Math.cos(ph)) * Math.sin(th), r * Math.sin(ph)], i * 3)
  }
  return a
}
function cube(n: number) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const p = [hash(i) * 3.4 - 1.7, hash(i + 0.5) * 3.4 - 1.7, hash(i + 0.25) * 3.4 - 1.7]
    p[Math.floor(hash(i + 0.75) * 3)] = hash(i + 0.9) > 0.5 ? 1.7 : -1.7 // push to a face
    a.set(p, i * 3)
  }
  return a
}
