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
  private lmStudioModel?: string;

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

    this.bot.on("message:text", async (ctx) => {
      if (ctx.msg.text.startsWith("/")) return;
      const response = await this.generateAssistantReply(ctx.msg.text);
      return ctx.reply(response);
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

        const llmProvider = String(process.env.LLM_PROVIDER || "none").toLowerCase();
        if (llmProvider !== "none") {
          const response = await this.generateAssistantReply(transcript);
          await this.bot.api.sendMessage(chatId, `Respuesta: ${response}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.bot?.api.sendMessage(chatId, `Error procesando audio: ${message}`);
      }
    });

    this.bot.catch((err) => {
      this.logger.warn(`Bot error: ${err.message}`);
    });
  }

  private async generateAssistantReply(userText: string) {
    const llmProvider = String(process.env.LLM_PROVIDER || "none").toLowerCase();
    if (llmProvider === "none") {
      return `Eco: ${userText}`;
    }
    if (llmProvider !== "lmstudio") {
      return `Proveedor LLM '${llmProvider}' no soportado.`;
    }

    try {
      return await this.callLmStudio(userText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error LLM: ${message}`;
    }
  }

  private async callLmStudio(userText: string) {
    const baseUrl = String(process.env.LLM_BASE_URL || "http://127.0.0.1:1234").replace(/\/$/, "");
    const apiKey = String(process.env.LLM_API_KEY || "lm-studio");
    const model = await this.resolveLmStudioModel(baseUrl, apiKey);
    const systemPrompt = String(
      process.env.LLM_SYSTEM_PROMPT ||
        "Responde en español de forma clara y breve. Si falta contexto, pregunta."
    );
    const temperature = Number(process.env.LLM_TEMPERATURE || "0.7");
    const maxTokens = Number(process.env.LLM_MAX_TOKENS || "256");

    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      temperature,
      max_tokens: maxTokens
    };

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LM Studio HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const trimmed = typeof content === "string" ? content.trim() : "";
    return trimmed || "No tengo respuesta.";
  }

  private async resolveLmStudioModel(baseUrl: string, apiKey: string) {
    if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
    if (this.lmStudioModel) return this.lmStudioModel;

    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`No pude obtener modelos: ${res.status} ${text}`);
    }
    const data = await res.json();
    const model = data?.data?.[0]?.id;
    if (!model) {
      throw new Error("No encontre modelos en LM Studio.");
    }
    this.lmStudioModel = model;
    return model;
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
    const language = String(process.env.WHISPER_LANGUAGE || "es").trim();

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

    const whisperArgs = [
      "-m",
      modelPath,
      "-f",
      wavPath,
      "-otxt",
      "-of",
      outPrefix
    ];
    if (language && language.toLowerCase() !== "auto") {
      whisperArgs.push("-l", language);
    }

    await this.runCommand(whisperPath, whisperArgs);

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