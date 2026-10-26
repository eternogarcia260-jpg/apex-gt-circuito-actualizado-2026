import * as THREE from 'three';

/** Lossless attribute compaction, never geometric simplification.
 * Hash collisions are resolved by comparing EVERY attribute byte. Triangle
 * sequence, hard normals, UV seams, vertex colours and signed zero survive.
 */
export function compactExactMarineGeometry(input: THREE.BufferGeometry): THREE.BufferGeometry {
  const attributes = Object.entries(input.attributes);
  const position = input.getAttribute('position');
  if (!position || Object.keys(input.morphAttributes).length > 0 || attributes.some(([, a]) => 'isInterleavedBufferAttribute' in a)) return input.clone();
  const vertexCount = position.count;
  if (attributes.some(([, a]) => a.count !== vertexCount)) return input.clone();
  const sourceIndex = input.getIndex(), indexCount = sourceIndex ? sourceIndex.count : vertexCount;
  const views = attributes.map(([, raw]) => {
    const attribute = raw as THREE.BufferAttribute, array = attribute.array;
    return { attribute, bytes: new Uint8Array(array.buffer, array.byteOffset, array.byteLength), stride: attribute.itemSize * array.BYTES_PER_ELEMENT };
  });
  const remapped = new Uint32Array(indexCount), oldToNew = new Int32Array(vertexCount);
  oldToNew.fill(-1);
  const uniqueOldIndices: number[] = [];
  const buckets = new Map<number, number | number[]>();
  function hash(vertex: number): number {
    let value = 2166136261;
    for (const view of views) {
      const start = vertex * view.stride;
      for (let i = start, end = start + view.stride; i < end; i++) value = Math.imul(value ^ view.bytes[i], 16777619);
    }
    return value >>> 0;
  }
  function equal(a: number, b: number): boolean {
    for (const view of views) {
      const startA = a * view.stride, startB = b * view.stride;
      for (let i = 0; i < view.stride; i++) if (view.bytes[startA + i] !== view.bytes[startB + i]) return false;
    }
    return true;
  }
  for (let i = 0; i < indexCount; i++) {
    const oldIndex = sourceIndex ? sourceIndex.getX(i) : i;
    if (!Number.isInteger(oldIndex) || oldIndex < 0 || oldIndex >= vertexCount) return input.clone();
    let mapped = oldToNew[oldIndex];
    if (mapped < 0) {
      const key = hash(oldIndex), candidates = buckets.get(key);
      if (typeof candidates === 'number') {
        if (equal(oldIndex, uniqueOldIndices[candidates])) mapped = candidates;
      } else if (candidates) {
        for (const candidate of candidates) if (equal(oldIndex, uniqueOldIndices[candidate])) { mapped = candidate; break; }
      }
      if (mapped < 0) {
        mapped = uniqueOldIndices.length; uniqueOldIndices.push(oldIndex);
        if (candidates === undefined) buckets.set(key, mapped);
        else if (typeof candidates === 'number') buckets.set(key, [candidates, mapped]);
        else candidates.push(mapped);
      }
      oldToNew[oldIndex] = mapped;
    }
    remapped[i] = mapped;
  }
  const output = new THREE.BufferGeometry(); output.name = input.name;
  try { output.userData = structuredClone(input.userData); }
  catch { output.userData = { ...input.userData }; }
  for (let a = 0; a < attributes.length; a++) {
    const [name] = attributes[a], view = views[a], attribute = view.attribute;
    // Same typed-array constructor; byte copying also preserves NaN payloads.
    const compactArray = attribute.array.slice(0, uniqueOldIndices.length * attribute.itemSize);
    const bytes = new Uint8Array(compactArray.buffer, compactArray.byteOffset, compactArray.byteLength);
    for (let vertex = 0; vertex < uniqueOldIndices.length; vertex++) {
      const oldStart = uniqueOldIndices[vertex] * view.stride, newStart = vertex * view.stride;
      for (let byte = 0; byte < view.stride; byte++) bytes[newStart + byte] = view.bytes[oldStart + byte];
    }
    const compactAttribute = new THREE.BufferAttribute(compactArray, attribute.itemSize, attribute.normalized);
    compactAttribute.name = attribute.name; compactAttribute.usage = attribute.usage; compactAttribute.gpuType = attribute.gpuType;
    output.setAttribute(name, compactAttribute);
  }
  output.setIndex(new THREE.BufferAttribute(remapped, 1));
  for (const group of input.groups) output.addGroup(group.start, group.count, group.materialIndex);
  output.setDrawRange(input.drawRange.start, input.drawRange.count);
  return output;
}
