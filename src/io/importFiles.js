import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { normalizeGeometry } from '../model/geometry'

// Loaded on demand (store.importFiles imports it), so the loaders stay out of
// the first paint.

/** File extensions the importer reads. */
export const IMPORT_EXTENSIONS = ['stl', 'glb', 'gltf']

const extOf = (name) => name.split('.').pop().toLowerCase()
export const canImport = (name) => IMPORT_EXTENSIONS.includes(extOf(name))

/** STL carries no unit; read it as mm, Z-up (as slicers do) and turn it Y-up. */
function parseStl(buffer) {
  const geo = new STLLoader().parse(buffer)
  geo.deleteAttribute('color') // per-face colours aren't drawn
  geo.rotateX(-Math.PI / 2) // Z-up → Y-up
  geo.scale(0.001, 0.001, 0.001) // mm → m
  return { geometry: geo, color: null }
}

/**
 * Every mesh in a glTF scene baked into one geometry in world space (meters, Y-up
 * as glTF defines), plus the first material colour found.
 * ponytail: skinning, morph targets and instancing are ignored — each mesh is
 * taken in its rest pose, once.
 */
async function parseGltf(buffer) {
  const gltf = await new GLTFLoader().parseAsync(buffer, '')
  gltf.scene.updateMatrixWorld(true)
  const parts = []
  let color = null
  gltf.scene.traverse((m) => {
    if (!m.isMesh) return
    const src = m.geometry
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', src.attributes.position.clone())
    if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal.clone())
    if (src.index) geo.setIndex(src.index.clone())
    geo.applyMatrix4(m.matrixWorld)
    parts.push(geo.toNonIndexed())
    const mat = Array.isArray(m.material) ? m.material[0] : m.material
    if (!color && mat?.color) color = `#${mat.color.getHexString()}`
  })
  if (!parts.length) throw new Error('No meshes in the file')
  // Keep the file's (smooth) normals unless some part lacks them; then all are
  // recomputed, flat, after normalizing.
  if (!parts.every((p) => p.attributes.normal)) parts.forEach((p) => p.deleteAttribute('normal'))
  const geometry = mergeGeometries(parts)
  return { geometry, color }
}

/**
 * Read one model file. Returns { name, geometry, center, size, color } with the
 * geometry normalized to a unit box (see model/geometry); size is in meters,
 * color is null when the file has none.
 */
export async function parseModel(fileName, buffer) {
  const ext = extOf(fileName)
  if (!IMPORT_EXTENSIONS.includes(ext)) throw new Error(`Unsupported file type .${ext}`)
  const { geometry, color } = ext === 'stl' ? parseStl(buffer) : await parseGltf(buffer)
  if (!geometry.attributes.position?.count) throw new Error('The file has no geometry')
  return { name: fileName.replace(/\.[^.]+$/, ''), color, ...normalizeGeometry(geometry) }
}
