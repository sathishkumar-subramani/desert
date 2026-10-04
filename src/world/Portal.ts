import * as THREE from 'three'
import { palette } from './palette'

/** Three broken stone rings that counter-rotate, align and light up. */
export class Portal {
  group = new THREE.Group()
  private rings: THREE.Mesh[] = []
  private glow: THREE.Mesh
  private color = new THREE.Color()

  constructor(position: [number, number, number], mat: THREE.Material) {
    this.group.position.set(...position)
    ;[4.4, 3.2, 2.1].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.34, 5, 120, Math.PI * (1.55 + i * 0.12)), mat)
      ring.geometry.rotateZ(i * 1.3)
      this.rings.push(ring)
      this.group.add(ring)
    })
    this.glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 64),
      new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, fog: false }),
    )
    this.group.add(this.glow, new THREE.PointLight(palette.gold, 60, 30, 1.5))
  }

  /** open: 0 = scattered and dark, 1 = aligned and glowing. */
  update(time: number, open: number) {
    this.rings.forEach((ring, i) => {
      const sign = i % 2 ? -1 : 1
      ring.rotation.z = time * 0.25 * sign
      ring.rotation.x = (1 - open) * 1.0 * sign
      ring.rotation.y = (1 - open) * 0.7 * (i - 1)
    })
    const mat = this.glow.material as THREE.MeshBasicMaterial
    mat.color.copy(this.color.copy(palette.gold).multiplyScalar(1 + open * 3))
    mat.opacity = open
    this.glow.scale.setScalar(0.3 + open * 0.7)
  }
}
