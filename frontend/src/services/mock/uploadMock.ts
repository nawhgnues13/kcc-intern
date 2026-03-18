export async function uploadAttachmentMock(
  fileType: 'pdf' | 'image',
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; url?: string }> {
  return new Promise((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      if (onProgress) {
        onProgress(progress);
      }
      
      if (progress >= 100) {
        clearInterval(interval);
        // Return a mock URL upon completion
        resolve({ 
          success: true, 
          url: fileType === 'image' 
            ? 'https://images.unsplash.com/photo-1718220216044-006f43e3a9b1?w=800' 
            : 'mock-pdf-url.pdf' 
        });
      }
    }, 300);
  });
}
