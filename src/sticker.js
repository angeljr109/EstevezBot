const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

/**
 * Convierte un buffer de video a un sticker WebP con audio
 * usando el nuevo formato de stickers de WhatsApp con audio.
 *
 * WhatsApp soporta stickers animados con audio en formato WebP
 * que contienen pistas de video (VP8/VP9) y audio (Opus).
 *
 * @param {Buffer} videoBuffer - Buffer del video original
 * @returns {Promise<Buffer>} - Buffer del sticker WebP con audio
 */
async function convertVideoToAudioSticker(videoBuffer) {
  const tmpId = crypto.randomBytes(8).toString("hex");
  const tmpDir = os.tmpdir();

  const inputPath = path.join(tmpDir, `input_${tmpId}.mp4`);
  const outputPath = path.join(tmpDir, `sticker_${tmpId}.webp`);

  try {
    // Escribir el video temporal
    fs.writeFileSync(inputPath, videoBuffer);

    // Verificar duración real del video
    const duration = getVideoDuration(inputPath);
    const maxDuration = Math.min(duration, 10); // máximo 10s para sticker

    /**
     * Comando FFmpeg para crear WebP animado con audio:
     * - Escala a 512x512 manteniendo proporción (formato estándar de stickers WA)
     * - FPS 15 para menor tamaño de archivo
     * - Codec de video: libwebp_anim (animación WebP, soporta múltiples frames)
     * - Codec de audio: libopus (requerido por WhatsApp para stickers con audio)
     * - Calidad balanceada para no exceder el límite de tamaño (~1MB)
     */
    await runFFmpeg([
      "-i", inputPath,
      "-t", String(maxDuration),
      // Video: escalar a 512x512 preservando aspect ratio con padding
      "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,fps=15",
      // Codec de video: libwebp_anim para animación WebP
      "-vcodec", "libwebp_anim",
      "-lossless", "0",
      "-compression_level", "6",
      "-q:v", "50",
      "-loop", "0",
      // Audio: Opus stereo 48kHz (estándar WhatsApp para stickers con audio)
      "-acodec", "libopus",
      "-ar", "48000",
      "-ac", "2",
      "-b:a", "64k",
      // Formato de salida WebP
      "-f", "webp",
      "-y",
      outputPath,
    ]);
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 100) {
      throw new Error("FFmpeg no generó el archivo de salida.");
    }

    // Verificar tamaño (WhatsApp rechaza stickers > ~1MB)
    const stats = fs.statSync(outputPath);
    if (stats.size > 1_000_000) {
      console.warn(`⚠️ Sticker grande (${(stats.size / 1024).toFixed(0)}KB), puede ser rechazado por WA`);
    }

    const stickerBuffer = fs.readFileSync(outputPath);
    return stickerBuffer;

  } finally {
    // Limpiar archivos temporales
    safeDelete(inputPath);
    safeDelete(outputPath);
  }
}

/**
 * Convierte video a sticker WebP animado CON audio embebido.
 * Este método crea un WebP con stream de audio Opus (nuevo formato WA).
 *
 * @param {Buffer} videoBuffer
 * @returns {Promise<Buffer>}
 */
async function convertVideoToAudioStickerV2(videoBuffer) {
  const tmpId = crypto.randomBytes(8).toString("hex");
  const tmpDir = os.tmpdir();

  const inputPath   = path.join(tmpDir, `input_${tmpId}.mp4`);
  const videoOnly   = path.join(tmpDir, `video_${tmpId}.webp`);
  const audioOnly   = path.join(tmpDir, `audio_${tmpId}.opus`);
  const outputPath  = path.join(tmpDir, `sticker_${tmpId}.webp`);

  try {
    fs.writeFileSync(inputPath, videoBuffer);
    const duration = Math.min(getVideoDuration(inputPath), 10);

    // Paso 1: extraer video como WebP animado (sin audio)
    await runFFmpeg([
      "-i", inputPath,
      "-t", String(duration),
      "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,fps=15",
      "-vcodec", "libwebp",
      "-lossless", "0",
      "-compression_level", "6",
      "-q:v", "50",
      "-loop", "0",
      "-an",
      "-f", "webp",
      "-y", videoOnly,
    ]);

    // Paso 2: extraer audio como Opus
    await runFFmpeg([
      "-i", inputPath,
      "-t", String(duration),
      "-vn",
      "-acodec", "libopus",
      "-ar", "48000",
      "-ac", "2",
      "-b:a", "64k",
      "-y", audioOnly,
    ]);

    // Paso 3: combinar WebP + Opus en un solo contenedor WebP
    // FFmpeg puede muxear audio en WebP con la opción correcta
    await runFFmpeg([
      "-i", videoOnly,
      "-i", audioOnly,
      "-c:v", "copy",
      "-c:a", "copy",
      "-f", "webp",
      "-y", outputPath,
    ]);

    const stickerBuffer = fs.readFileSync(outputPath);
    return stickerBuffer;

  } finally {
    safeDelete(inputPath);
    safeDelete(videoOnly);
    safeDelete(audioOnly);
    safeDelete(outputPath);
  }
}

/**
 * Obtiene la duración de un video en segundos usando ffprobe
 */
function getVideoDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: "utf8" }
    ).trim();
    return parseFloat(result) || 5;
  } catch {
    return 5; // valor por defecto si falla
  }
}

/**
 * Ejecuta un comando FFmpeg de forma asíncrona
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error("FFmpeg stderr:", stderr.slice(-500));
        reject(new Error(`FFmpeg terminó con código ${code}`));
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Elimina un archivo sin lanzar error si no existe
 */
function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {}
}

module.exports = {
  convertVideoToAudioSticker,
  convertVideoToAudioStickerV2,
};
