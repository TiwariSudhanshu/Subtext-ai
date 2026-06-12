declare module "ffmpeg-static" {
  /** Absolute path to the bundled ffmpeg binary (null if unsupported platform). */
  const ffmpegPath: string | null;
  export default ffmpegPath;
}

declare module "ffprobe-static" {
  const ffprobeStatic: { path: string };
  export default ffprobeStatic;
}
