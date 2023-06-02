export type UnnormalizedMeta = {
  p?: string | string[]
  perms?: string | string[]
  sd?: string
  shortDescription?: string
  dd?: string
  detailedDescription?: string
}

export type ModuleStructureMeta = {
  type: string
  perms?: string[]
  shortDescription?: string
  detailedDescription?: string
}

export default class MetadataHolder<TMeta extends UnnormalizedMeta = UnnormalizedMeta> {
  #meta: ModuleStructureMeta & Omit<TMeta, keyof UnnormalizedMeta>

  constructor( meta:TMeta, type:string ) {
    let perms = meta.p ?? meta.perms ?? []
    if (!Array.isArray( perms )) perms = [ perms ]

    this.#meta = {
      ...meta,
      type,
      perms,
      detailedDescription: meta.dd ?? meta.detailedDescription,
      shortDescription: meta.sd ?? meta.shortDescription,
    }
  }

  get meta() {
    return this.#meta
  }
}
