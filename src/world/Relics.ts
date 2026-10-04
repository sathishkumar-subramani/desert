import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { palette } from './palette'

export interface RelicDef { id: string; title: string; position: [number, number, number] }

/**
 * Three pieces of amber, each sealing a real object (models from relics.glb):
 * a pyritised ammonite, a terracotta amphora and a scarab beetle.
 * The shell uses physical transmission: you see the object, and the desert
 * behind it, refracted through the resin.
 */
export class Relics {
  group = new THREE.Group()
  items: { def: RelicDef; root: THREE.Group; shell: THREE.Mesh }[] = []

  constructor(defs: RelicDef[], gltf: GLTF) {
    const geo = (name: string) => (gltf.scene.getObjectByName(name) as THREE.Mesh).geometry
    const contents: { name: string; material: THREE.Material; rotation: [number, number, number]; scale: number }[] = [
      { name: 'relic_ammonite', rotation: [Math.PI / 2, 0, 0.3], scale: 1.25,
        material: new THREE.MeshStandardMaterial({ color: '#c8a55e', metalness: 1, roughness: 0.38 }) },
      { name: 'relic_amphora', rotation: [0.12, 0, -0.18], scale: 1.15,
        material: new THREE.MeshStandardMaterial({ color: '#a4532f', roughness: 0.72 }) },
      { name: 'relic_scarab', rotation: [Math.PI / 2, 0, 0], scale: 0.95,
        material: new THREE.MeshPhysicalMaterial({ color: '#0c4a36', metalness: 1, roughness: 0.22, iridescence: 1, iridescenceIOR: 1.8 }) },
    ]
    defs.forEach((def, i) => {
      const root = new THREE.Group()
      root.position.set(...def.position)
      const shell = new THREE.Mesh(
        geo(`amber_${(i % 3) + 1}`),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff, roughness: 0.04, transmission: 1, thickness: 0.5, ior: 1.25,
          attenuationColor: palette.amber, attenuationDistance: 3.4,
          clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.4,
        }),
      )
      shell.userData.relic = def.id
      const c = contents[i % contents.length]
      const core = new THREE.Mesh(geo(c.name), c.material)
      core.rotation.set(...c.rotation)
      core.scale.setScalar(c.scale)
      root.add(core, shell)
      this.group.add(root)
      this.items.push({ def, root, shell })
    })
  }

  update(time: number) {
    this.items.forEach(({ root, def }, i) => {
      root.rotation.y = Math.sin(time * 0.25 + i * 2) * 0.45
      root.position.y = def.position[1] + Math.sin(time * 0.7 + i) * 0.12
    })
  }
}
