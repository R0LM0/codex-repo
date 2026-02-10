# Telegram bot (NestJS + TS)

## Requisitos

- Node 18+
- Token de BotFather

## Pasos

1. Copia `.env.example` a `.env`
2. Agrega tu token
3. pnpm install
4. pnpm run start:dev

## Nota

Este bot usa `grammy` (no depende de `request`), por lo que evita los warnings de dependencias obsoletas.

## Voz

- El bot descarga el audio y responde con texto.
- Para STT gratis, integra whisper.cpp local y ajusta estas variables:

STT_PROVIDER=whispercpp
WHISPER_CPP_PATH=...
FFMPEG_PATH=...
WHISPER_MODEL_PATH=...

Notas:
- `FFMPEG_PATH` puede ser `ffmpeg` si esta en PATH.
- `WHISPER_CPP_PATH` debe apuntar a `whisper-cli.exe` si esta disponible (o `main.exe` como fallback).

## Instalacion automatica (Windows)

Ejecuta este script para descargar whisper.cpp, un modelo y configurar `.env`:

```powershell
.\scripts\install-whispercpp.ps1
```

Por defecto usa `ggml-base.bin`. Para otro modelo:

```powershell
.\scripts\install-whispercpp.ps1 -ModelName ggml-tiny.bin
```
