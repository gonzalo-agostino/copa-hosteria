export async function compressImageForUpload(
  file: File,
  options: { maxSize?: number; preserveTransparency?: boolean } = {}
): Promise<{ blob: Blob; ext: string }> {
  const { maxSize = 480, preserveTransparency = false } = options;
  const keepPng =
    preserveTransparency &&
    (file.type === "image/png" || file.type === "image/webp");
  const targetMime = keepPng ? "image/png" : "image/jpeg";
  const ext = keepPng ? "png" : "jpg";

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ blob: file, ext });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve({ blob, ext });
          else resolve({ blob: file, ext });
        },
        targetMime,
        keepPng ? undefined : 0.85
      );
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}
