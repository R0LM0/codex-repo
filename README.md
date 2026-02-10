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

## Tips

- `codex login` abre el navegador para autenticar.
- Puedes ajustar el modelo con `-m` o `--model`.
- Si falla por repo no confiable, mueve el workdir al repo o usa `--skip-git-repo-check`.
