const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { convertVideoToAudioSticker } = require("./src/sticker");

const logger = pino({ level: "silent" });

// Carpeta donde se guarda la sesión
const AUTH_FOLDER = "./auth_info";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ["EstevezBot", "Chrome", "1.0.0"],
  });

  // Guardar credenciales cuando cambien
  sock.ev.on("creds.update", saveCreds);

  // Manejar cambios de conexión
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.clear();
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("         📱 EstevezBot - Scan QR Code       ");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      qrcode.generate(qr, { small: true });
      console.log("\nEscanea el código con WhatsApp > Dispositivos vinculados\n");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        `❌ Conexión cerrada. Reconectando: ${shouldReconnect}`,
        lastDisconnect?.error?.message
      );
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log("🚫 Sesión cerrada. Elimina la carpeta auth_info y reinicia.");
      }
    }

    if (connection === "open") {
      console.log("✅ EstevezBot conectado correctamente!\n");
      console.log("📌 Comandos disponibles:");
      console.log("   • Envía un video → recibe un sticker con audio 🎵");
      console.log("   • !ping → prueba que el bot está activo\n");
    }
  });

  // Manejar mensajes entrantes
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      // Ignorar mensajes propios
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const messageContent = msg.message;

      if (!messageContent) continue;

      try {
        // Comando !ping
        const textMsg =
          messageContent.conversation ||
          messageContent.extendedTextMessage?.text ||
          "";

        if (textMsg.toLowerCase() === "!ping") {
          await sock.sendMessage(from, { text: "🏓 *Pong!* EstevezBot está activo." });
          continue;
        }

        if (textMsg.toLowerCase() === "!ayuda" || textMsg.toLowerCase() === "!help") {
          await sock.sendMessage(from, {
            text:
              "🤖 *EstevezBot* - Comandos disponibles:\n\n" +
              "🎬 *Video → Sticker con audio*\n" +
              "Envía cualquier video (hasta 10 segundos) y te lo devuelvo como un sticker animado con audio.\n\n" +
              "📌 *Comandos de texto:*\n" +
              "• `!ping` - Verificar si el bot está activo\n" +
              "• `!ayuda` - Mostrar este menú",
          });
          continue;
        }

        // Detectar si es un video
        const isVideo =
          messageContent.videoMessage ||
          (messageContent.documentMessage &&
            messageContent.documentMessage.mimetype?.startsWith("video/"));

        if (isVideo) {
          const videoMsg =
            messageContent.videoMessage || messageContent.documentMessage;
          const duration = videoMsg.seconds || 0;

          // Validar duración máxima (WhatsApp limita stickers a ~10s recomendado)
          if (duration > 15) {
            await sock.sendMessage(from, {
              text: "⚠️ El video es demasiado largo. Por favor envía un video de máximo *15 segundos* para convertirlo a sticker con audio.",
            });
            continue;
          }

          // Notificar que estamos procesando
          await sock.sendMessage(from, {
            text: "⏳ Procesando tu video como sticker con audio... un momento 🎬🔊",
          });

          // Descargar el video
          console.log(`📥 Descargando video de ${from}...`);
          const videoBuffer = await downloadMediaMessage(
            msg,
            "buffer",
            {},
            { logger, reuploadRequest: sock.updateMediaMessage }
          );

          // Convertir a sticker con audio
          console.log("🔄 Convirtiendo a sticker con audio...");
          const stickerBuffer = await convertVideoToAudioSticker(videoBuffer);

          // Enviar el sticker
          await sock.sendMessage(from, {
            sticker: stickerBuffer,
          });

          console.log(`✅ Sticker con audio enviado a ${from}`);
        }
      } catch (error) {
        console.error("❌ Error procesando mensaje:", error.message);
        try {
          await sock.sendMessage(from, {
            text: "❌ Ocurrió un error al procesar el video. Asegúrate de que el video sea válido e intenta de nuevo.",
          });
        } catch (_) {}
      }
    }
  });
}

// Crear carpeta auth si no existe
if (!fs.existsSync("./auth_info")) {
  fs.mkdirSync("./auth_info", { recursive: true });
}

console.log("🚀 Iniciando EstevezBot...\n");
startBot().catch(console.error);
