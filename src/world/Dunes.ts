import * as THREE from 'three'
import { smoothstep, vnoise } from '../core/math'

/**
 * Dune field. Ridged noise makes crests; skewing the ridge makes the windward
 * side long and gentle and the lee side short and steep, like real dunes.
 * The camera corridor in the middle stays almost flat.
 */
export const duneHeight = (x: number, z: number) => {
  const warp = vnoise(x * 0.012 + 40, z * 0.012) * 30
  const n = vnoise((x + warp) * 0.016 + 3, z * 0.03)
  const t = Math.abs(n * 2 - 1)                 // 0 on the crest line
  const crest = Math.pow(1 - t, 1.6)
  const lee = n > 0.5 ? 1 : 0.72                // steeper on one side
  const big = crest * lee * 11
  const small = Math.pow(1 - Math.abs(vnoise(x * 0.05 + 11, z * 0.085 + 5) * 2 - 1), 2) * 1.6
  const corridor = smoothstep(7, 40, Math.abs(x))
  // keep the open ground smooth: with a 9 degree sun every small bump throws a long dark patch
  return (big + small) * corridor + vnoise(x * 0.035, z * 0.035) * 0.5
}

export function createDunes(pbr: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }) {
  const geo = new THREE.PlaneGeometry(420, 460, 300, 330)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, -110)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, duneHeight(p.getX(i), p.getZ(i)))
  geo.computeVertexNormals()

  // one texture tile covers 3 x 3 metres
  for (const t of [pbr.map, pbr.normalMap, pbr.roughnessMap]) t.repeat.set(420 / 3, 460 / 3)
  const mat = new THREE.MeshStandardMaterial({ ...pbr, normalScale: new THREE.Vector2(1.0, 1.0), envMapIntensity: 1 })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec3 vWPos;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`)
      // large-scale tone variation hides the texture repeating
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        float macro = vn(vWPos.xz * 0.045) * 0.6 + vn(vWPos.xz * 0.19) * 0.4;
        diffuseColor.rgb *= 0.86 + 0.26 * macro;`)

  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  return mesh
}
