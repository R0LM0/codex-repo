import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Bot } from "grammy";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Bot;

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.error("Falta TELEGRAM_BOT_TOKEN en .env");
      process.exit(1);
    }

    this.bot = new Bot(token);
    this.registerHandlers();
    this.bot.start({
      onStart: () => this.logger.log("Bot iniciado (long polling)")
    });
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.bot.stop();
      this.logger.log("Bot detenido");
    }
  }

  private registerHandlers() {
    if (!this.bot) return;

    this.bot.command("start", (ctx) => {
      return ctx.reply("Listo. Enviame un texto o un audio.");
    });

    this.bot.on("message:text", (ctx) => {
      if (!ctx.msg.text.startsWith("/")) {
        return ctx.reply(`Eco: ${ctx.msg.text}`);
      }
    });

    this.bot.on("message:voice", async (ctx) => {
      if (!this.bot || !ctx.chat) return;
      const chatId = ctx.chat.id;
      try {
        const fileId = ctx.msg.voice.file_id;
        await ctx.reply("Audio recibido. Procesando...");
        await this.bot.api.sendVoice(chatId, fileId, { caption: "Eco de tu audio" });

        const file = await this.bot.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const tempDir = path.join(os.tmpdir(), "codex-telegram-bot-nest");
        await fsp.mkdir(tempDir, { recursive: true });
        const oggPath = path.join(tempDir, `${fileId}.ogg`);
        await this.downloadToFile(fileUrl, oggPath);

        const sttProvider = String(process.env.STT_PROVIDER || "none").toLowerCase();
        if (sttProvider === "none") {
          await this.bot.api.sendMessage(chatId, "Transcripcion desactivada. Configura STT_PROVIDER si quieres activar STT.");
          return;
        }

        if (sttProvider !== "whispercpp") {
          await this.bot.api.sendMessage(chatId, `STT_PROVIDER '${sttProvider}' no soportado aun.`);
          return;
        }

        const transcript = await this.transcribeWithWhisperCpp(oggPath);
        if (!transcript) {
          await this.bot.api.sendMessage(chatId, "No pude transcribir el audio.");
          return;
        }

        await this.bot.api.sendMessage(chatId, `Transcripcion: ${transcript}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.bot?.api.sendMessage(chatId, `Error procesando audio: ${message}`);
      }
    });

    this.bot.catch((err) => {
      this.logger.warn(`Bot error: ${err.message}`);
    });
  }

  private async downloadToFile(url: string, filePath: string) {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`No se pudo descargar audio (${res.status})`);
    }
    await pipeline(res.body, fs.createWriteStream(filePath));
  }

  private async transcribeWithWhisperCpp(oggPath: string) {
    const whisperPath = process.env.WHISPER_CPP_PATH;
    const modelPath = process.env.WHISPER_MODEL_PATH;
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

    if (!whisperPath || !modelPath) {
      throw new Error("Faltan WHISPER_CPP_PATH o WHISPER_MODEL_PATH en .env");
    }

    const tempDir = path.dirname(oggPath);
    const baseName = path.basename(oggPath, ".ogg");
    const wavPath = path.join(tempDir, `${baseName}.wav`);
    const outPrefix = path.join(tempDir, `${baseName}`);
    const outTxt = `${outPrefix}.txt`;

    await this.runCommand(ffmpegPath, [
      "-y",
      "-i",
      oggPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wavPath
    ]);

    await this.runCommand(whisperPath, [
      "-m",
      modelPath,
      "-f",
      wavPath,
      "-otxt",
      "-of",
      outPrefix
    ]);

    const text = await fsp.readFile(outTxt, "utf8");
    return text.trim();
  }

  private async runCommand(command: string, args: string[]) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { windowsHide: true });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`${command} fallo (code ${code}): ${stderr.trim()}`));
      });
    });
  }
}