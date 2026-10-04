import * as THREE from 'three'
// Colours come mostly from the HDR sky and the textures. What is left here are
// the tints that must agree with them.
export const palette = {
  haze: new THREE.Color('#d9bca6'),   // distant air: warm, slightly pink
  sun: new THREE.Color('#ffd9b0'),    // direct light, sun 14 degrees up
  sandTint: new THREE.Color('#c98a5e'), // sand that has settled on rock ledges
  gold: new THREE.Color('#ffb648'),   // the one accent: light inside the temple and the gate
  amber: new THREE.Color('#e08a1c'),
  ink: new THREE.Color('#2a1c14'),
}
/** Direction TOWARDS the sun: behind the camera, to the left, so it rakes across the temple front. */
export const SUN_DIR = new THREE.Vector3(-0.8, 0.249, 0.6).normalize()
/** Yaw that turns the HDR so its sun (at +X in three.js equirect space) lines up with SUN_DIR. */
export const SKY_YAW = Math.atan2(-SUN_DIR.z, SUN_DIR.x)
