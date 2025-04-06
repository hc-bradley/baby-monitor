interface ImageCapture {
  takePhoto(): Promise<Blob>;
  getPhotoCapabilities(): Promise<PhotoCapabilities>;
  getPhotoSettings(): Promise<PhotoSettings>;
  grabFrame(): Promise<ImageBitmap>;
}

interface ImageCaptureConstructor {
  new(track: MediaStreamTrack): ImageCapture;
}

declare var ImageCapture: ImageCaptureConstructor;