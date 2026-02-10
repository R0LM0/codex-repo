const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { pipeline } = require("node:stream/promises");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN en .env");
  process.exit(1);
}

const sttProvider = String(process.env.STT_PROVIDER || "none").toLowerCase();

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Listo. Enviame un texto o un audio.");
});

bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, `Eco: ${msg.text}`);
  }
});

bot.on("voice", async (msg) => {
  const chatId = msg.chat.id;
  try {
    const fileId = msg.voice.file_id;
    await bot.sendMessage(chatId, "Audio recibido. Procesando...");
    await bot.sendVoice(chatId, fileId, { caption: "Eco de tu audio" });

    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const tempDir = path.join(os.tmpdir(), "codex-telegram-bot");
    await fsp.mkdir(tempDir, { recursive: true });
    const oggPath = path.join(tempDir, `${fileId}.ogg`);
    await downloadToFile(fileUrl, oggPath);

    if (sttProvider === "none") {
      await bot.sendMessage(chatId, "Transcripcion desactivada. Configura STT_PROVIDER si quieres activar STT.");
      return;
    }

    await bot.sendMessage(chatId, "STT_PROVIDER configurado, pero la integracion no esta implementada.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await bot.sendMessage(chatId, `Error procesando audio: ${message}`);
  }
});

async function downloadToFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`No se pudo descargar audio (${res.status})`);
  }
  await pipeline(res.body, fs.createWriteStream(filePath));
}
