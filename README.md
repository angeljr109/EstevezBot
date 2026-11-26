# 🤖 EstevezBot

Bot de WhatsApp construido con **Baileys** que recibe videos y los convierte en **stickers con audio** — la nueva funcionalidad de WhatsApp donde los stickers pueden tener sonido.

---

## ✨ Funcionalidades

| Función | Descripción |
|---|---|
| 🎬 → 🔊 Sticker con audio | Envía un video (máx. 15s) y lo recibe como sticker animado con sonido |
| `!ping` | Verifica que el bot está activo |
| `!ayuda` | Muestra el menú de comandos |

---

## 📋 Requisitos

- **Node.js** v18 o superior
- **FFmpeg** instalado en el sistema
- Una cuenta de **WhatsApp** activa

### Instalar FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg -y
```

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Windows:**
Descarga desde [ffmpeg.org](https://ffmpeg.org/download.html) y agrégalo al PATH.

---

## 🚀 Instalación

```bash
# 1. Clona el repositorio
git clone https://github.com/TU_USUARIO/EstevezBot.git
cd EstevezBot

# 2. Instala las dependencias
npm install

# 3. Inicia el bot
npm start
```

---

## 📱 Primer uso

1. Ejecuta `npm start`
2. Aparecerá un **código QR** en la terminal
3. Abre WhatsApp en tu teléfono → **Dispositivos vinculados** → **Vincular dispositivo**
4. Escanea el QR
5. ✅ ¡El bot está activo!

La sesión se guarda en la carpeta `auth_info/` — no la elimines o tendrás que escanear el QR de nuevo.

---

## 🎬 Cómo usar el sticker con audio

1. Envía cualquier video al número del bot (duración máxima: **15 segundos**)
2. El bot responderá con el video convertido en un **sticker animado con audio**
3. El sticker aparecerá en tu bandeja de stickers de WhatsApp con sonido 🔊

---

## 📁 Estructura del proyecto

```
EstevezBot/
├── index.js          # Punto de entrada principal del bot
├── src/
│   └── sticker.js    # Módulo de conversión de video a sticker con audio
├── auth_info/        # Sesión de WhatsApp (se genera automáticamente)
├── package.json
└── README.md
```

---

## ⚙️ Cómo funciona la conversión

```
Video recibido
     ↓
Descargar buffer del video (Baileys)
     ↓
FFmpeg: escalar a 512x512px, 15fps
     ↓
Codificar video como WebP animado (libwebp)
     ↓
Codificar audio como Opus 48kHz (libopus)
     ↓
Muxear en contenedor WebP con audio
     ↓
Enviar como sticker a WhatsApp ✅
```

---

## 🛠️ Variables de configuración

Puedes ajustar estos valores en `src/sticker.js`:

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `maxDuration` | `10` segundos | Duración máxima del sticker |
| `fps` | `15` | Fotogramas por segundo |
| `q:v` | `50` | Calidad del video (0-100) |
| `b:a` | `64k` | Bitrate del audio |

---

## 🐛 Solución de problemas

**El QR no aparece:**
- Asegúrate de que Node.js v18+ está instalado

**Error al convertir el video:**
- Verifica que FFmpeg está instalado: `ffmpeg -version`
- El video debe ser un formato soportado (MP4, MOV, AVI, MKV)

**El sticker no tiene audio:**
- Verifica que tu versión de WhatsApp es la más reciente
- Esta función requiere WhatsApp v2.24.x o superior

**Sesión expirada:**
```bash
rm -rf auth_info/
npm start
```

---

## 📄 Licencia

MIT © EstevezBot
