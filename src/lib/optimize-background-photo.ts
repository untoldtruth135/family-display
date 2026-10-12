// Bound both resolution and encoded bytes before sending a display photo to Storage.
export async function optimizeBackgroundPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Unable to decode photo.")); });
    const canvas = document.createElement("canvas");
    let edge = 1920;
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo processing unavailable.");
      context.fillStyle = "#eef1f3"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78 - attempt * 0.08));
      if (blob && blob.size <= 400000 && blob.size > 0) return blob;
      edge = Math.round(edge * 0.75);
    }
    throw new Error("Unable to reduce photo below 400 KB.");
  } finally { URL.revokeObjectURL(url); }
}
