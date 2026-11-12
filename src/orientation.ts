/** Quarter-turn mesh positions about its bounding-box centre. No input mutation. */
export function rotateMesh(a: Float32Array, axis: "x" | "y", direction: -1 | 1): Float32Array {
  if (!a.length || a.length % 3) throw Error("Invalid mesh positions.");
  const lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<a.length;i+=3) for(let j=0;j<3;j++) {
    lo[j]=Math.min(lo[j],a[i+j]);hi[j]=Math.max(hi[j],a[i+j]);
  }
  const centre=lo.map((v,i)=>(v+hi[i])/2), out=new Float32Array(a.length);
  for(let i=0;i<a.length;i+=3) {
    const x=a[i]-centre[0], y=a[i+1]-centre[1], z=a[i+2]-centre[2];
    if(axis==="x") {
      out[i]=a[i];out[i+1]=centre[1]-direction*z;out[i+2]=centre[2]+direction*y;
    } else {
      out[i]=centre[0]+direction*z;out[i+1]=a[i+1];out[i+2]=centre[2]-direction*x;
    }
  }
  return out;
}
