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
WHISPER_LANGUAGE=es

Notas:
- `FFMPEG_PATH` puede ser `ffmpeg` si esta en PATH.
- `WHISPER_CPP_PATH` debe apuntar a `whisper-cli.exe` si esta disponible (o `main.exe` como fallback).
- `WHISPER_LANGUAGE=es` fuerza español (evita "speaking in foreign language").

## Instalacion automatica (Windows)

Ejecuta este script para descargar whisper.cpp, un modelo y configurar `.env`:

```powershell
.\scripts\install-whispercpp.ps1
```

Por defecto usa `ggml-base.bin`. Para otro modelo:

```powershell
.\scripts\install-whispercpp.ps1 -ModelName ggml-tiny.bin
```

## IA (LM Studio)

Para respuestas inteligentes (texto y voz), activa LM Studio:

```
LLM_PROVIDER=lmstudio
LLM_BASE_URL=http://127.0.0.1:1234
LLM_API_KEY=
LLM_MODEL=
LLM_INTEGRATIONS=
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=256
LLM_CONTEXT_LENGTH=
LLM_REASONING=
```

Notas:
- Si LM Studio no requiere auth, deja `LLM_API_KEY` vacio.
- Si activas auth en LM Studio, coloca el token en `LLM_API_KEY`.
- Si no configuras `LLM_MODEL`, el bot usara el primer modelo disponible en LM Studio.
- `LLM_INTEGRATIONS` acepta JSON (ej: `["mcp/playwright"]`) o lista separada por comas.

Ejemplos de `LLM_INTEGRATIONS`:

```
["mcp/playwright"]
```

```
[{"type":"ephemeral_mcp","server_label":"huggingface","server_url":"https://huggingface.co/mcp","allowed_tools":["model_search"]}]
```
