# Hora

[![CI](https://github.com/JasperGwyn/hora/actions/workflows/ci.yml/badge.svg)](https://github.com/JasperGwyn/hora/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2d6a4f.svg)](LICENSE)

App de Windows para medir a qué proyecto le dedicás el tiempo. Vive en la bandeja del sistema y no interrumpe mientras trabajás.

*A Windows tray app that tracks which project actually got your attention each hour — idle time does not count.*

## Cómo funciona

1. Cargás los nombres de los proyectos en los que estás trabajando.
2. Hora corre en segundo plano y mira si la computadora se está usando de verdad (teclado/mouse). El tiempo idle no cuenta.
3. Al terminar cada hora del reloj (por ejemplo 14:00–15:00) te pregunta a qué proyecto le dedicaste el tiempo de uso real.
4. Si en esa hora no usaste la computadora, no pregunta.

Después podés reasignar o dividir un tramo ya guardado desde el dashboard.

Cerrar la ventana no cierra la app: queda en la bandeja. Para salir del todo, clic derecho en el icono → **Salir**.

## Por qué existe

La mayoría de los trackers te piden que pulses play/pause o que elijas un proyecto *antes* de trabajar. Hora hace lo inverso: espera a que la hora cierre, cuenta solo el uso real y recién ahí pregunta. Menos fricción, menos mentiras piadosas al timer.

## Stack

Electron + React + TypeScript. Los tests de dominio (horas, splits, idle) corren con Vitest, sin levantar la UI.

## Desarrollo

Necesitás Windows y Node.js 22+.

```bash
npm install
npm run dev
```

Para probar la pregunta sin esperar al cierre de hora: clic derecho en la bandeja → **Probar pregunta de esta hora**.

```bash
npm run check-all
npm run dist
```

`npm run dist` genera el instalador NSIS y el portable en `dist/`.

## Contribuir

Issues y PRs son bienvenidos. Leé [CONTRIBUTING.md](CONTRIBUTING.md) antes de mandar código.

## Licencia

[MIT](LICENSE)
