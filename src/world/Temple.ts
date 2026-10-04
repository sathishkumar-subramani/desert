import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hash } from '../core/math'
import { palette } from './palette'

type Pbr = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }

/**
 * Hero: a rock-cut temple front. Modelled in Blender (temple.glb):
 *   temple         battered wall, stepped door frames, cornice, plinth (materials: stone + facade)
 *   column         lathe-turned column with a bud capital
 *   column_broken  a snapped shaft
 *   rock           the outcrop it is built into (vertex colour = where sand has settled)
 * The carved front uses its own texture pair; everything else shares the tiling stone set.
 */
export class Temple {
  group = new THREE.Group()
  private glow: THREE.Mesh
  private light = new THREE.PointLight(palette.gold, 0, 30, 1.6)
  private glowColor = new THREE.Color()

  constructor(gltf: GLTF, stone: Pbr, facade: { map: THREE.Texture; normalMap: THREE.Texture }, blocks: THREE.BufferGeometry[]) {
    const stoneMat = new THREE.MeshStandardMaterial({ ...stone, normalScale: new THREE.Vector2(1.3, 1.3), color: new THREE.Color(1.08, 0.96, 0.8) })
    const facadeMat = new THREE.MeshStandardMaterial({ ...facade, roughness: 0.88, normalScale: new THREE.Vector2(1.6, 1.6) })
    const rockMat = new THREE.MeshStandardMaterial({ ...stone, vertexColors: true, normalScale: new THREE.Vector2(2.2, 2.2) })
    // rock: dark stone where it is steep, pale sand where the vertex colour says sand has settled
    rockMat.onBeforeCompile = (shader) => {
      shader.uniforms.uSand = { value: palette.sandTint }
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSand;')
        .replace('#include <color_fragment>', /* glsl */ `
          float sandy = smoothstep(0.55, 0.95, vColor.r);
          diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.42, 0.33, 0.27), uSand, sandy);`)
        .replace('#include <normal_fragment_maps>', /* glsl */ `
          vec3 nGeo = normal;
          #include <normal_fragment_maps>
          normal = normalize(mix(normal, nGeo, sandy * 0.8)); // sand is smooth`)
    }

    const pick = (name: string) => gltf.scene.getObjectByName(name)!
    const temple = pick('temple').clone()
    temple.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = (m.material as THREE.Material).name === 'facade' ? facadeMat : stoneMat
      m.castShadow = m.receiveShadow = true
    })
    const rock = pick('rock').clone() as THREE.Mesh
    // the decimated mesh arrives faceted; rebuild smooth normals, keeping only real creases sharp
    rock.geometry = toCreasedNormals(rock.geometry, THREE.MathUtils.degToRad(50))
    // the sand mask is the second colour set in the file when the exporter writes two
    const mask = rock.geometry.getAttribute('color_1') ?? rock.geometry.getAttribute('color')
    rock.geometry.setAttribute('color', mask)
    rock.material = rockMat
    rock.castShadow = rock.receiveShadow = true
    this.group.add(temple, rock)

    // an avenue of columns leading to the door; one has fallen
    const column = (pick('column') as THREE.Mesh).geometry
    const broken = (pick('column_broken') as THREE.Mesh).geometry
    const spots: [number, number, boolean][] = [[-4.7, 4, false], [4.7, 4, false], [-4.7, 10, false], [4.7, 10, true], [-7.5, 16, true]]
    spots.forEach(([x, z, isBroken]) => {
      const mesh = new THREE.Mesh(isBroken ? broken : column, stoneMat)
      mesh.position.set(x, -0.25, z)
      mesh.scale.set(0.72, 1, 0.72)
      mesh.castShadow = mesh.receiveShadow = true
      this.group.add(mesh)
    })
    // a second outcrop far away, so the temple is not the only thing on the horizon
    const far = rock.clone()
    far.position.set(-95, -4, -150); far.rotation.y = 2.2; far.scale.set(3.2, 3.6, 3.2)
    far.castShadow = false
    this.group.add(far)

    // fallen stones around the approach (the sculpted block variants), half buried
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    blocks.forEach((geo, v) => {
      const n = 6
      const mesh = new THREE.InstancedMesh(geo, stoneMat, n)
      for (let k = 0; k < n; k++) {
        const i = v * 10 + k
        const side = hash(i + 1) > 0.5 ? 1 : -1
        const pos = new THREE.Vector3(side * (5.5 + hash(i + 2) * 9), -0.1 + hash(i + 3) * 0.2, 2 + hash(i + 4) * 20)
        q.setFromEuler(e.set((hash(i + 5) - 0.5) * 1.2, hash(i + 6) * 6.28, (hash(i + 7) - 0.5) * 1.2))
        mesh.setMatrixAt(k, m.compose(pos, q, new THREE.Vector3().setScalar(0.7 + hash(i + 8) * 0.7)))
      }
      mesh.castShadow = mesh.receiveShadow = true
      this.group.add(mesh)
    })

    // light from inside: an HDR plane at the back of the passage + a point light spilling onto the steps
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // brightest low in the middle, falling off towards the lintel: a lamp deep inside, not a lit card
      fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main() { float d = length((vUv - vec2(0.5, 0.22)) * vec2(1.5, 1.0)); gl_FragColor = vec4(uColor * (0.12 + 1.4 * exp(-d * d * 7.0)), 1.0); }',
    }))
    this.glow.position.set(0, 2.3, -1.1)
    this.light.position.set(0, 2.2, -0.5)
    this.group.add(this.glow, this.light)
    this.setGlow(0)
  }

  /** k: 0 = resting glow, 1 = the door floods with light as the camera enters. */
  setGlow(k: number) {
    ;(this.glow.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(this.glowColor.copy(palette.gold).multiplyScalar(2.4 + k * 5))
    this.light.intensity = 30 + k * 90
  }
}
