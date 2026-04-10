export interface EncodedFileUpload {
  fileName: string;
  contentType: string;
  base64Content: string;
  size: number;
}

export const encodeFileToPayload = (file: File): Promise<EncodedFileUpload> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64Content = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Content,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
