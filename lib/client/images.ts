/** Read a stored preview or rack image for upload/export without exposing API keys. */
export async function imageDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:image/")) return url;
  const target = new URL(url, location.origin);
  const source = target.origin === location.origin ? target.href : `/api/image?url=${encodeURIComponent(target.href)}`;
  const response = await fetch(source);
  if (!response.ok) throw new Error("This image could not be loaded. Restore its photo before rendering or exporting.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Expected an image.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(blob);
  });
}
