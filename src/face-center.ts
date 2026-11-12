/** Centre a connected, nearly coplanar patch of STL triangles selected by raycast. */
export type FaceCenter = {
  point: [number, number, number];
  normal: [number, number, number];
  triangles: number[];
};

export function findPlanarFaceCenter(positions: Float32Array, seed: number): FaceCenter {
  const count = positions.length / 9;
  if (!Number.isInteger(seed) || seed < 0 || seed >= count || !Number.isInteger(count))
    throw Error("Select a valid mesh face.");
  const vertex = (triangle: number, corner: number): [number, number, number] => {
    const offset = triangle * 9 + corner * 3;
    return [positions[offset], positions[offset + 1], positions[offset + 2]];
  };
  const key = (v: number[]) => v.join(",");
  const edges = new Map<string, number[]>();
  const faceEdges: string[][] = [];
  const normals: [number, number, number][] = [];
  const areas: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = vertex(i, 0), b = vertex(i, 1), c = vertex(i, 2);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross: [number, number, number] = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const magnitude = Math.hypot(...cross);
    areas.push(magnitude / 2);
    normals.push(magnitude > 0 ? cross.map(n => n / magnitude) as [number,number,number] : [0,0,0]);
    const corners = [a,b,c];
    const own: string[] = [];
    for (let j = 0; j < 3; j++) {
      const left = key(corners[j]), right = key(corners[(j + 1) % 3]);
      const edge = left < right ? `${left}|${right}` : `${right}|${left}`;
      own.push(edge);
      const owners = edges.get(edge) ?? [];
      owners.push(i);
      edges.set(edge, owners);
    }
    faceEdges.push(own);
  }
  if (areas[seed] === 0) throw Error("Selected face has zero area.");
  const origin = vertex(seed, 0), normal = normals[seed];
  const seen = new Uint8Array(count);
  const queue = [seed], triangles: number[] = [];
  seen[seed] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const i = queue[cursor];
    triangles.push(i);
    for (const edge of faceEdges[i]) for (const other of edges.get(edge) ?? []) {
      if (seen[other] || areas[other] === 0) continue;
      const dot = normals[other].reduce((sum, n, axis) => sum + n * normal[axis], 0);
      if (dot < Math.cos(5 * Math.PI / 180)) continue;
      const coplanar = [0,1,2].every(corner => {
        const p = vertex(other, corner);
        return Math.abs(normal.reduce((sum, n, axis) => sum + n * (p[axis] - origin[axis]), 0)) <= 0.1;
      });
      if (!coplanar) continue;
      seen[other] = 1;
      queue.push(other);
    }
  }
  let area = 0;
  const weighted = [0,0,0];
  for (const i of triangles) {
    const a = vertex(i,0), b = vertex(i,1), c = vertex(i,2);
    area += areas[i];
    for (let axis = 0; axis < 3; axis++)
      weighted[axis] += ((a[axis]+b[axis]+c[axis])/3)*areas[i];
  }
  const centre = weighted.map(v => v/area) as [number,number,number];
  // A concave patch can have its arithmetic centre in a void. In that case,
  // use the nearest triangle's centre so the anchor remains on the surface.
  const inside = (i: number) => {
    const a=vertex(i,0), b=vertex(i,1), c=vertex(i,2);
    const dot = (u:number[],v:number[]) => u.reduce((s,x,k)=>s+x*v[k],0);
    const ab=b.map((x,k)=>x-a[k]), ac=c.map((x,k)=>x-a[k]), ap=centre.map((x,k)=>x-a[k]);
    const d00=dot(ab,ab), d01=dot(ab,ac), d11=dot(ac,ac), d20=dot(ap,ab), d21=dot(ap,ac);
    const denom=d00*d11-d01*d01;
    if (denom<=1e-12) return false;
    const v=(d11*d20-d01*d21)/denom, w=(d00*d21-d01*d20)/denom;
    return v>=-1e-5 && w>=-1e-5 && v+w<=1+1e-5;
  };
  if (!triangles.some(inside)) {
    let distance=Infinity;
    let closest: [number,number,number] | undefined;
    for (const i of triangles) {
      const a=vertex(i,0), b=vertex(i,1), c=vertex(i,2);
      const mid=a.map((v,k)=>(v+b[k]+c[k])/3) as [number,number,number];
      const d=Math.hypot(...mid.map((v,k)=>v-centre[k]));
      if (d<distance) {distance=d;closest=mid;}
    }
    if (closest) centre.splice(0,3,...closest);
  }
  return { point: centre, normal, triangles };
}
