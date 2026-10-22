export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ image, url })
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo abrir ${file.name}`)) }
    image.src = url
  })
}

// Creates a square white canvas and fits the entire product image inside it.
// This normalizes format and margins; it does not remove the original background.
export async function normalizeImage(file, settings = {}) {
  const { image, url } = await loadImage(file)
  try {
    const size = settings.size || 1080
    const margin = settings.margin ?? 0.1
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const maxSide = size * (1 - margin * 2)
    const scale = Math.min(maxSide / image.width, maxSide / image.height)
    const width = image.width * scale
    const height = image.height * scale
    const x = (size - width) / 2
    const y = (size - height) / 2
    ctx.filter = `brightness(${settings.brightness ?? 1}) contrast(${settings.contrast ?? 1}) saturate(${settings.saturation ?? 1})`
    ctx.drawImage(image, x, y, width, height)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen')), 'image/jpeg', 0.94))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
