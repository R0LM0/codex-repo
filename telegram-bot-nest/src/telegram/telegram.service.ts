import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: TelegramBot;

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.error("Falta TELEGRAM_BOT_TOKEN en .env");
      process.exit(1);
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.registerHandlers();
    this.logger.log("Bot iniciado (long polling)");
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stopPolling();
      this.logger.log("Bot detenido");
    }
  }

  private registerHandlers() {
    if (!this.bot) return;

    this.bot.onText(/\/start/, (msg) => {
      this.bot?.sendMessage(msg.chat.id, "Listo. Enviame un texto o un audio.");
    });

    this.bot.on("message", (msg) => {
      if (msg.text && !msg.text.startsWith("/")) {
        this.bot?.sendMessage(msg.chat.id, `Eco: ${msg.text}`);
      }
    });

    this.bot.on("voice", async (msg) => {
      if (!this.bot) return;
      const chatId = msg.chat.id;
      try {
        const fileId = msg.voice.file_id;
        await this.bot.sendMessage(chatId, "Audio recibido. Procesando...");
        await this.bot.sendVoice(chatId, fileId, { caption: "Eco de tu audio" });

        const file = await this.bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const tempDir = path.join(os.tmpdir(), "codex-telegram-bot-nest");
        await fsp.mkdir(tempDir, { recursive: true });
        const oggPath = path.join(tempDir, `${fileId}.ogg`);
        await this.downloadToFile(fileUrl, oggPath);

        const sttProvider = String(process.env.STT_PROVIDER || "none").toLowerCase();
        if (sttProvider === "none") {
          await this.bot.sendMessage(chatId, "Transcripcion desactivada. Configura STT_PROVIDER si quieres activar STT.");
          return;
        }

        await this.bot.sendMessage(chatId, "STT_PROVIDER configurado, pero la integracion no esta implementada.");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.bot?.sendMessage(chatId, `Error procesando audio: ${message}`);
      }
    });

    this.bot.on("polling_error", (err) => {
      this.logger.warn(`Polling error: ${err.message}`);
    });
  }

  private async downloadToFile(url: string, filePath: string) {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`No se pudo descargar audio (${res.status})`);
    }
    await pipeline(res.body, fs.createWriteStream(filePath));
  }
}
