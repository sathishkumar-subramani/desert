import * as THREE from 'three'
import { hash } from '../core/math'
import { palette } from './palette'

interface Block { variant: number; slot: number; home: THREE.Matrix4; dir: THREE.Vector3; spin: THREE.Vector3; delay: number }

/**
 * Hero object: a ruined round tower. The blocks are six sculpted variants
 * exported from Blender; each variant is one InstancedMesh, so the whole
 * tower plus the rubble around it costs six draw calls.
 * `setExplode(k)` blends every block between its home and a pulled-out pose.
 */
export class Tower {
  group = new THREE.Group()
  private meshes: THREE.InstancedMesh[] = []
  private blocks: Block[] = []
  private light = new THREE.PointLight(palette.gold, 0, 40, 1.4)
  private core: THREE.Mesh
  private coreColor = new THREE.Color()

  constructor(variants: THREE.BufferGeometry[], material: THREE.Material, rows = 13, perRow = 14, radius = 2.5) {
    const h = 0.62
    const counts = variants.map(() => 0)
    const tints: THREE.Color[][] = variants.map(() => [])
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), tilt = new THREE.Quaternion(), e = new THREE.Euler()
    const add = (i: number, pos: THREE.Vector3, quat: THREE.Quaternion, scale: THREE.Vector3, dir: THREE.Vector3) => {
      const variant = Math.floor(hash(i + 17) * variants.length)
      this.blocks.push({
        variant, slot: counts[variant]++, home: m.compose(pos, quat, scale).clone(), dir,
        spin: new THREE.Vector3(hash(i + 7) - 0.5, hash(i + 13) - 0.5, hash(i + 21) - 0.5), delay: hash(i + 3) * 0.35,
      })
      const v = 0.78 + hash(i + 62) * 0.3 // some stones are simply darker than others
      tints[variant].push(new THREE.Color(v, v * (0.97 + hash(i + 61) * 0.05), v * (0.94 + hash(i + 60) * 0.08)))
    }

    let i = 0
    for (let r = 0; r < rows; r++) {
      const taper = 1 - r * 0.022
      for (let c = 0; c < perRow; c++, i++) {
        const a = ((c + (r % 2) * 0.5) / perRow) * Math.PI * 2
        const facing = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)))
        if (r < 4 && facing < 0.3) continue // doorway towards the camera (+Z)
        if (r >= rows - 3 && hash(i + 41) < (r - (rows - 4)) * 0.3) continue // broken crown
        const pos = new THREE.Vector3(Math.cos(a) * radius * taper, h * (r + 0.5) - 0.08, Math.sin(a) * radius * taper)
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -a + Math.PI / 2 + (hash(i + 30) > 0.5 ? Math.PI : 0))
        q.multiply(tilt.setFromEuler(e.set((hash(i + 1) - 0.5) * 0.06, (hash(i + 2) - 0.5) * 0.07, (hash(i + 3) - 0.5) * 0.05)))
        const dir = new THREE.Vector3(Math.cos(a), (hash(i) - 0.35) * 0.8, Math.sin(a)).multiplyScalar(0.35 + hash(i + 99) * 1.1)
        add(i, pos, q, new THREE.Vector3(1, 1, 0.95 + hash(i + 5) * 0.15), dir)
      }
    }
    // rubble: fallen stones half buried around the base (they never move)
    for (let k = 0; k < 26; k++, i++) {
      const a = hash(i + 200) * Math.PI * 2, d = radius + 1.2 + hash(i + 201) ** 1.6 * 9
      const pos = new THREE.Vector3(Math.cos(a) * d, -0.12 + hash(i + 202) * 0.22, Math.sin(a) * d)
      q.setFromEuler(e.set((hash(i + 203) - 0.5) * 1.2, hash(i + 204) * 6.28, (hash(i + 205) - 0.5) * 1.2))
      add(i, pos, q, new THREE.Vector3().setScalar(0.55 + hash(i + 206) * 0.5), new THREE.Vector3())
    }

    variants.forEach((geo, v) => {
      const mesh = new THREE.InstancedMesh(geo, material, counts[v])
      tints[v].forEach((c, k) => mesh.setColorAt(k, c))
      mesh.castShadow = mesh.receiveShadow = true
      this.meshes.push(mesh)
      this.group.add(mesh)
    })

    // toneMapped:false + values above 1.0 = HDR, which is what the bloom pass picks up
    this.core = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.5, radius * 0.62, rows * h * 0.78, 32, 1, true),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false, fog: false }),
    )
    this.core.position.y = (rows * h * 0.78) / 2
    this.light.position.y = 2.2
    this.group.add(this.core, this.light)
    this.setExplode(0)
  }

  private m = new THREE.Matrix4()
  private p = new THREE.Vector3()
  private q = new THREE.Quaternion()
  private s = new THREE.Vector3()
  private e = new THREE.Euler()
  private dq = new THREE.Quaternion()

  /** k = 0 fully assembled, k = 1 fully pulled apart. */
  setExplode(k: number) {
    for (const b of this.blocks) {
      const ki = THREE.MathUtils.smoothstep(k, b.delay, 1)
      b.home.decompose(this.p, this.q, this.s)
      this.p.addScaledVector(b.dir, ki)
      if (b.dir.lengthSq() > 0) {
        this.e.set(b.spin.x * ki, b.spin.y * ki, b.spin.z * ki)
        this.q.multiply(this.dq.setFromEuler(this.e))
      }
      this.meshes[b.variant].setMatrixAt(b.slot, this.m.compose(this.p, this.q, this.s))
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true
    this.light.intensity = 18 + k * 120
    ;(this.core.material as THREE.MeshBasicMaterial).color.copy(this.coreColor.copy(palette.gold).multiplyScalar(3.0 + k * 4))
  }
}
