# Telegram bot (NestJS + TS)

## Requisitos

- Node 18+
- Token de BotFather

## Pasos

1. Copia `.env.example` a `.env`
2. Agrega tu token
3. npm install
4. npm run start:dev

## Voz

- El bot descarga el audio y responde con texto.
- Para STT gratis, integra whisper.cpp local y ajusta estas variables:

STT_PROVIDER=whispercpp
WHISPER_CPP_PATH=...
FFMPEG_PATH=...
WHISPER_MODEL_PATH=...

Este repo deja el hook preparado, pero no instala whisper.cpp.
