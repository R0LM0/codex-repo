# codex-repo

Repositorio de ejemplo para usar Codex CLI.

## Que es `codex exec`

`codex exec` ejecuta Codex de forma no interactiva con un prompt que le pasas en la linea de comandos. Es util para scripts o tareas rapidas.

## Requisitos

- Estar dentro de un repo Git confiable (o usar `--skip-git-repo-check` si sabes lo que haces).
- Haber iniciado sesion con `codex login`.

## Uso rapido

```bash
codex exec "hola"
```

## Ejemplos

- Ver `examples/01-hola.txt` y `examples/02-resumen.txt`.

## Telegram bot (Node, local)

- Carpeta: `telegram-bot/` (version simple)
- Copia `.env.example` a `.env` y coloca tu token de BotFather
- `npm install`
- `npm run start`

## Telegram bot (NestJS + TS, local)

- Carpeta: `telegram-bot-nest/`
- Copia `.env.example` a `.env` y coloca tu token de BotFather
- `pnpm install`
- `pnpm run start:dev`

## Voz (gratis)

- El bot acepta mensajes de voz y responde con texto.
- Para transcripcion gratis, puedes integrar `whisper.cpp` local (ver `telegram-bot/README.md`).

## MCP (nota simple)

- Carpeta: `mcp/`
- `npm install`
- `npm run start`
- Registrar en Codex:

```bash
codex mcp add notes -- node D:\WORKSPACES\AGENTES\CODEX\codex-repo\mcp\src\server.js
```

- Verificar:

```bash
codex mcp list
```
