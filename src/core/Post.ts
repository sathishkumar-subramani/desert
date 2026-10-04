import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/**
 * scene -> bloom (only HDR pixels glow) -> lens pass (storm haze, chromatic
 * aberration driven by scroll speed, vignette) -> tone mapping -> film grain.
 */
export class Post {
  composer: EffectComposer
  private bloom: UnrealBloomPass
  private lens: ShaderPass
  private grain: ShaderPass

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, haze: THREE.Color) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(renderer, target)
    this.composer.addPass(new RenderPass(scene, camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.7, 1.6)
    this.composer.addPass(this.bloom)

    this.lens = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uVel: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uHaze: { value: haze }, uGold: { value: new THREE.Color('#ffd58a') } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float uVel, uStorm, uFlash; uniform vec3 uHaze, uGold; varying vec2 vUv;
        void main() {
          vec2 c = vUv - 0.5;
          float r2 = dot(c, c);
          vec2 off = c * r2 * (0.012 + uVel * 0.16);           // stronger towards the edges
          vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
          col = mix(col, uHaze * 1.15, uStorm * 0.8);           // sandstorm wipes the frame
          col = mix(col, uGold * 1.6, uFlash);                  // walking into the lit doorway
          col *= 1.0 - r2 * 0.75;                               // vignette
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.composer.addPass(this.lens)
    this.composer.addPass(new OutputPass())

    this.grain = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
        float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec3 col = texture2D(tDiffuse, vUv).rgb;
          col += (rnd(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.045;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.composer.addPass(this.grain)
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(w, h)
  }

  render(time: number, velocity: number, storm: number, flash = 0) {
    this.lens.uniforms.uFlash.value = flash
    this.lens.uniforms.uVel.value = Math.min(Math.abs(velocity), 1.5)
    this.lens.uniforms.uStorm.value = storm
    this.grain.uniforms.uTime.value = time
    this.composer.render()
  }
}
