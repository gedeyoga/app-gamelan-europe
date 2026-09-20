import { useRef, useState } from 'react'

export interface FileDropHandlers {
  onDragEnter: (event: React.DragEvent<HTMLElement>) => void
  onDragOver: (event: React.DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent<HTMLElement>) => void
}

export interface UseFileDropResult {
  isDragging: boolean
  dropHandlers: FileDropHandlers
}

/**
 * Drop file native (HTML5 DnD) untuk area upload.
 * `onFiles` menerima file mentah — validasi tipe/ukuran milik pemanggil.
 */
export function useFileDrop(
  onFiles: (files: File[]) => void,
  disabled = false,
): UseFileDropResult {
  const [isDragging, setIsDragging] = useState(false)
  // Counter agar dragleave saat melewati child node tidak memicu flicker.
  const depth = useRef(0)

  function hasFiles(event: React.DragEvent<HTMLElement>) {
    return event.dataTransfer.types.includes('Files')
  }

  return {
    isDragging,
    dropHandlers: {
      onDragEnter: (event) => {
        if (!hasFiles(event)) return
        depth.current += 1
        if (!disabled) setIsDragging(true)
      },
      onDragOver: (event) => {
        if (!hasFiles(event)) return
        // preventDefault walau disabled agar browser tidak membuka file yang dijatuhkan.
        event.preventDefault()
        if (disabled) return
        event.dataTransfer.dropEffect = 'copy'
        setIsDragging(true)
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setIsDragging(false)
      },
      onDrop: (event) => {
        if (event.dataTransfer.files.length === 0) return
        event.preventDefault()
        depth.current = 0
        setIsDragging(false)
        if (disabled) return
        onFiles(Array.from(event.dataTransfer.files))
      },
    },
  }
}
