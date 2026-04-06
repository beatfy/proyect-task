/**
 * Utilidad para comprimir imágenes antes de subirlas.
 * Redimensiona a un máximo de 1920px y comprime JPEG/PNG/WebP.
 * Devuelve un File con el nombre original preservado.
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;
const WEBP_QUALITY = 0.8;

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  maxFileSize?: number; // Si tras comprimir sigue siendo mayor, rechazar
}

/**
 * Comprime una imagen si es necesario.
 * - Si el archivo no es imagen, lo devuelve sin cambios.
 * - Si es imagen y ya es menor que maxFileSize, la devuelve sin cambios.
 * - Si es imagen grande, redimensiona y comprime.
 */
export async function compressImageIfNeeded(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension || MAX_DIMENSION;
  const quality = options.quality || JPEG_QUALITY;
  const maxFileSize = options.maxFileSize || Infinity;

  // Si no es imagen, devolver sin cambios
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Si ya es menor que el tamaño máximo, devolver sin cambios
  if (file.size <= maxFileSize) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calcular nuevas dimensiones manteniendo aspect ratio
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      // Dibujar en canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo crear contexto canvas"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Determinar formato de salida
      // Para PNG/GIF usamos webp que comprime mejor
      const outputType =
        file.type === "image/jpeg"
          ? "image/jpeg"
          : "image/webp";
      const outputQuality = file.type === "image/jpeg" ? quality : WEBP_QUALITY;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Si falla la compresión, devolver original
            resolve(file);
            return;
          }

          // Si el comprimido es más grande (caso raro), devolver original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          // Cambiar extensión si cambió el tipo
          const originalName = file.name;
          let newName = originalName;
          if (outputType === "image/webp" && !originalName.toLowerCase().endsWith(".webp")) {
            const baseName = originalName.replace(/\.[^.]+$/, "");
            newName = `${baseName}.webp`;
          }

          const compressedFile = new File([blob], newName, {
            type: outputType,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        outputType,
        outputQuality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Si no se puede cargar como imagen, devolver original
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Formatea bytes a string legible
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
