/* Fitting a scan into Discord's upload limit: scaled down by halves with nearest-neighbour, so every block stays a sharp square of pixels */

import sharp from "sharp"
import type { ScanImage } from "./backend.js"

/** 4096 px wide scans stop at 256 px; smaller ones aren't worth showing */
const MIN_SCALE = 1 / 16

/** The PNG as it is when it fits `maxBytes`, otherwise the largest halved scale that fits; `png` is null when none does */
export async function fitImage( png:Buffer, maxBytes:number ): Promise<ScanImage> {
  if (png.length <= maxBytes) return { png, scale:1 }

  const { width } = await sharp( png ).metadata()

  for (let scale = 1 / 2;  scale >= MIN_SCALE;  scale /= 2) {
    const scaledPng = await sharp( png ).resize({ width:Math.max( 1, Math.round( width * scale ) ), kernel:`nearest` }).png({ compressionLevel:9 }).toBuffer()
    if (scaledPng.length <= maxBytes) return { png:scaledPng, scale }
  }

  return { png:null, scale:1 }
}
