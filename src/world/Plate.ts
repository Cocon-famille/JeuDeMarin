import * as THREE from "three";

/** Draws "NOM · PLAQUE" onto a small canvas texture, mounted front & rear. */
function makePlateTexture(name: string, plate: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#10141c";
  ctx.font = "700 30px Barlow, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = plate.trim() || "TRACTO-01";
  ctx.fillText(label.toUpperCase().slice(0, 12), canvas.width / 2, canvas.height / 2 + 2);
  if (name.trim()) {
    ctx.font = "500 14px Barlow, Helvetica, sans-serif";
    ctx.fillStyle = "#5a6478";
    ctx.fillText(name.trim().slice(0, 18), canvas.width / 2, canvas.height - 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function addPlates(group: THREE.Group, halfLength: number, name: string, plate: string) {
  const geo = new THREE.PlaneGeometry(0.9, 0.24);
  const texture = makePlateTexture(name, plate);
  const mat = new THREE.MeshBasicMaterial({ map: texture });

  const front = new THREE.Mesh(geo, mat);
  front.name = "plateFront";
  front.position.set(0, 0.35, halfLength + 0.01);
  group.add(front);

  const rear = new THREE.Mesh(geo, mat.clone());
  rear.name = "plateRear";
  rear.position.set(0, 0.35, -halfLength - 0.01);
  rear.rotation.y = Math.PI;
  group.add(rear);
}
