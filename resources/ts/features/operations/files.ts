import type { Attachment } from '@/features/operations/types'

export async function prepareFiles(files: File[]): Promise<Attachment[]> {
  if (files.length > 6)
    throw new Error('Attach up to six files at a time.')
  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > 25 * 1024 * 1024)
    throw new Error('Keep the combined file size under 25 MB.')

  return Promise.all(files.map(async file => {
    if (!/\.(?:pdf|png|jpe?g|webp|docx?|xlsx?|mp4)$/i.test(file.name) || file.size > 20 * 1024 * 1024)
      throw new Error('Use PDF, image, Office or MP4 files smaller than 20 MB.')
    let dataUrl: string | undefined
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= 512 * 1024) {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Unable to read this image. Try another file.'))
        reader.readAsDataURL(file)
      })
    }

    return { id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, dataUrl }
  }))
}
