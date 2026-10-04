import * as THREE from 'three'
import { VirtualScroll } from './core/VirtualScroll'
import { CameraPath, type Shot } from './core/CameraPath'
import { Assets } from './core/Assets'
import { Post } from './core/Post'
import { smoothstep } from './core/math'
import { palette, SUN_DIR } from './world/palette'
import { applySky, createSunDisc } from './world/Sky'
import { createDunes } from './world/Dunes'
import { Temple } from './world/Temple'
import { Relics, type RelicDef } from './world/Relics'
import { Portal } from './world/Portal'
import { Swarm } from './world/Swarm'
import { Dust } from './world/Dust'

// ---------------------------------------------------------------- layout ---
// The temple stands at the origin, door facing +Z. The journey goes through
// the door and on along -Z. Edit here to re-stage the film.
const RELICS: RelicDef[] = [
  { id: 'relic_01', title: 'Relic 01', position: [-8, 2.7, -44] },
  { id: 'relic_02', title: 'Relic 02', position: [7, 2.7, -68] },
  { id: 'relic_03', title: 'Relic 03', position: [-5, 2.7, -92] },
]
const PORTAL: [number, number, number] = [0, 5, -122]
const SWARM: [number, number, number] = [0, 4, -150]

const SECTIONS = [
  { name: 'The Temple', hint: 'Scroll to enter' },
  { name: RELICS[0].title, hint: 'Ammonite / click to open' },
  { name: RELICS[1].title, hint: 'Amphora / click to open' },
  { name: RELICS[2].title, hint: 'Scarab / click to open' },
  { name: 'The Gate', hint: 'Keep going' },
  { name: 'Signals', hint: 'Left / right arrows' },
]
const SHOTS: Shot[] = [
  { at: 0, position: [0, 1.8, 22], lookAt: [0, 4.0, 0] },
  { at: 0.26, position: [0, 2.1, 7], lookAt: [0, 2.6, -6] },        // between the columns (keys are spaced by distance, so speed stays even)
  { at: 0.43, position: [0, 2.2, -2.5], lookAt: [0, 2.4, -20] },    // through the door
  { at: 1, position: [-5.0, 2.4, -35.5], lookAt: RELICS[0].position },
  { at: 2, position: [4.0, 2.4, -59.5], lookAt: RELICS[1].position },
  { at: 3, position: [-2.0, 2.4, -83.5], lookAt: RELICS[2].position },
  { at: 4, position: [0, 3.2, -107], lookAt: PORTAL },
  { at: 5, position: [0, 3.6, -140], lookAt: SWARM },
]

// -------------------------------------------------------------- renderer ---
const container = document.getElementById('webgl')!
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.shadowMap.autoUpdate = false // nothing that casts a shadow moves: draw the shadow map once (see below)
container.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(palette.haze, 0.0085) // atmospheric perspective; the storm adds the rest
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900)

// ---------------------------------------------------------------- assets ---
const assets = new Assets(renderer)
await assets.loadAll({
  hdr: { sky: '/assets/sky_dusk.hdr' },
  models: { blocks: '/assets/blocks.glb', temple: '/assets/temple.glb', relics: '/assets/relics.glb' },
  images: {
    sand_albedo: '/assets/sand_albedo.jpg', sand_normal: '/assets/sand_normal.jpg', sand_rough: '/assets/sand_rough.jpg',
    stone_albedo: '/assets/stone_albedo.jpg', stone_normal: '/assets/stone_normal.jpg', stone_rough: '/assets/stone_rough.jpg',
    facade_albedo: '/assets/facade_albedo.jpg', facade_normal: '/assets/facade_normal.jpg',
  },
})

// The sky panorama (rendered in Blender) is both what you see and what lights the scene.
applySky(scene, assets.texture('sky'))

// The sun itself: a directional light for crisp shadows + a small HDR disc for the bloom to grab.
const sun = new THREE.DirectionalLight(palette.sun, 4.6)
sun.position.copy(SUN_DIR).multiplyScalar(90).add(new THREE.Vector3(0, 0, 8))
sun.target.position.set(0, 0, 8)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.camera.left = sun.shadow.camera.bottom = -26
sun.shadow.camera.right = sun.shadow.camera.top = 26
sun.shadow.camera.far = 220
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.05
const sunDisc = createSunDisc()
scene.add(sun, sun.target, sunDisc)

// ----------------------------------------------------------------- world ---
const facadeMaps = (() => {
  const map = assets.texture('facade_albedo'), normalMap = assets.texture('facade_normal')
  map.colorSpace = THREE.SRGBColorSpace
  map.flipY = normalMap.flipY = false // glTF UV convention
  map.anisotropy = normalMap.anisotropy = 8
  return { map, normalMap }
})()
const blockGeos: THREE.BufferGeometry[] = []
assets.model('blocks').scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) blockGeos.push((o as THREE.Mesh).geometry) })

const stone = assets.pbr('stone', 1)
const temple = new Temple(assets.model('temple'), stone, facadeMaps, blockGeos)
const relics = new Relics(RELICS, assets.model('relics'))
const portal = new Portal(PORTAL, new THREE.MeshStandardMaterial({ ...stone, normalScale: new THREE.Vector2(1.4, 1.4) }))
const swarm = new Swarm(SWARM)
const dust = new Dust()
scene.add(createDunes(assets.pbr('sand', 1)), temple.group, relics.group, portal.group, swarm.points, dust.points)

const post = new Post(renderer, scene, camera, palette.haze)
renderer.shadowMap.needsUpdate = true

// ----------------------------------------------------------------- input ---
const scroll = new VirtualScroll(renderer.domElement, SECTIONS.length)
const path = new CameraPath(SHOTS)
const pointer = new THREE.Vector2()
const pointerSmooth = new THREE.Vector2()
window.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
})
window.addEventListener('keydown', (e) => {
  if (Math.round(scroll.current) !== SECTIONS.length - 1) return
  if (e.key === 'ArrowRight') swarm.next(1)
  if (e.key === 'ArrowLeft') swarm.next(-1)
})
const raycaster = new THREE.Raycaster()
renderer.domElement.addEventListener('click', (e) => {
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), camera)
  const hit = raycaster.intersectObjects(relics.items.map((r) => r.shell))[0]
  if (hit) console.log('open project detail:', hit.object.userData.relic) // detail view comes in a later stage
})

function resize() {
  const w = window.innerWidth, h = window.innerHeight
  const pr = Math.min(window.devicePixelRatio, 1.5)
  renderer.setPixelRatio(pr)
  renderer.setSize(w, h)
  post.setSize(w, h, pr)
  camera.aspect = w / h
  camera.fov = w / h < 1 ? 60 : 42 // keep the subject framed on tall (phone) screens
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

// -------------------------------------------------------------------- ui ---
const hud = document.getElementById('hud')!
const title = document.getElementById('title')!
const [idxEl, nameEl, hintEl] = Array.from(title.children) as HTMLElement[]
const ticks = document.getElementById('ticks')!
SECTIONS.forEach(() => ticks.appendChild(document.createElement('i')))
let shown = -1
function setSection(i: number) {
  if (i === shown) return
  shown = i
  title.classList.add('out')
  setTimeout(() => {
    idxEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(SECTIONS.length).padStart(2, '0')}`
    nameEl.textContent = SECTIONS[i].name
    hintEl.textContent = SECTIONS[i].hint
    title.classList.remove('out')
  }, 350)
  Array.from(ticks.children).forEach((t, k) => t.classList.toggle('on', k === i))
}

// ------------------------------------------------------------------ loop ---
const clock = new THREE.Clock()
let fps = 60

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1)
  const time = clock.elapsedTime
  scroll.update(dt)
  const p = scroll.current

  pointerSmooth.lerp(pointer, 1 - Math.exp(-4 * dt))
  path.apply(camera, p, pointerSmooth)
  sunDisc.position.copy(camera.position).addScaledVector(SUN_DIR, 800)

  // leg 0: walk up the avenue, the doorway floods with gold, then you come out into a sandstorm
  const flash = smoothstep(0.37, 0.44, p) * (1 - smoothstep(0.45, 0.6, p))
  let storm: number
  if (p < 1) storm = smoothstep(0.42, 0.54, p) * (1 - smoothstep(0.68, 0.97, p))
  else {
    const between = 1 - Math.abs((p - Math.floor(p)) * 2 - 1)
    storm = smoothstep(0.25, 1, between) * (p < 3 ? 0.45 : 1)
  }
  temple.setGlow(Math.max(smoothstep(0.08, 0.43, p), (Math.sin(time * 0.8) * 0.5 + 0.5) * 0.12))

  // only what the camera can reach is drawn
  temple.group.visible = p < 0.46
  relics.group.visible = p > 0.45 && p < 4.4 // the refraction pass is costly; skip it when no relic is in view
  portal.group.visible = p > 2.6
  swarm.points.visible = p > 4.2
  relics.update(time)
  portal.update(time, smoothstep(3.4, 4, p))
  swarm.update(time, dt)
  dust.update(time, storm)

  post.render(time, scroll.velocity, storm, flash)

  setSection(Math.round(p))
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05
  hud.textContent = `p ${p.toFixed(2)}  fps ${fps.toFixed(0)}`
  requestAnimationFrame(frame)
}
frame()

// handy while developing: __app.scroll.goTo(3)
;(window as unknown as Record<string, unknown>).__app = { scroll, scene, camera, renderer, swarm }
