import { BufferGeometry, Material, Mesh, MeshStandardMaterial, type MeshStandardMaterialParameters } from "three";

export class Kit {
  private geos = new Map<string, BufferGeometry>();
  private mats = new Map<string, Material>();

  geo<T extends BufferGeometry>(key: string, make: () => T): T {
    let g = this.geos.get(key) as T | undefined;
    if (!g) {
      g = make();
      this.geos.set(key, g);
    }
    return g;
  }

  mat(color: string, opts: MeshStandardMaterialParameters = {}): MeshStandardMaterial {
    const key = `${color}|${opts.roughness ?? 0.62}|${opts.metalness ?? 0}|${opts.emissive ?? ""}`;
    let m = this.mats.get(key) as MeshStandardMaterial | undefined;
    if (!m) {
      m = new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...opts });
      this.mats.set(key, m);
    }
    return m;
  }

  own<T extends Material>(key: string, make: () => T): T {
    let m = this.mats.get(key) as T | undefined;
    if (!m) {
      m = make();
      this.mats.set(key, m);
    }
    return m;
  }

  mesh(g: BufferGeometry, m: Material, x = 0, y = 0, z = 0): Mesh {
    const mesh = new Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.frustumCulled = false;
    return mesh;
  }

  triangles(): number {
    let n = 0;
    for (const g of this.geos.values()) n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    return n;
  }

  dispose() {
    for (const g of this.geos.values()) g.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.geos.clear();
    this.mats.clear();
  }
}
