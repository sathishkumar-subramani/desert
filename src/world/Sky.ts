import * as THREE from 'three'
import { SKY_YAW } from './palette'

/**
 * The sky is an HDR panorama rendered in Blender (physically based sky model,
 * sun 9 degrees above the horizon). It is used twice: as the visible
 * background and as the light source for every material (image-based lighting).
 */
export function applySky(scene: THREE.Scene, sky: THREE.Texture) {
  sky.mapping = THREE.EquirectangularReflectionMapping
  scene.background = sky
  scene.environment = sky
  scene.backgroundRotation.y = scene.environmentRotation.y = SKY_YAW
  scene.backgroundIntensity = 1
  scene.environmentIntensity = 1.0
}

/** A small HDR disc where the sun is, so the bloom pass has something to grab. */
export function createSunDisc() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(7, 24, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(40, 30, 18), toneMapped: false, fog: false }),
  )
}
