# Contribuir a Hora

Gracias por querer sumarte. El proyecto es chico a propósito: una app de Windows que vive en la bandeja y pregunta, al cierre de cada hora, a qué proyecto le dedicaste el tiempo de uso real.

## Requisitos

- Windows
- Node.js 22 o superior
- npm

## Setup

```bash
npm install
npm run dev
```

Para probar la pregunta sin esperar al cierre de hora: clic derecho en el icono de la bandeja → **Probar pregunta de esta hora**.

## Antes de abrir un PR

```bash
npm run check-all
```

Eso corre lint, typecheck y tests. Tiene que pasar sin cambios manuales.

## Convenciones

- TypeScript estricto, sin `any` fuera de tests.
- Sin `console.*` en código de producción: usá el logger del módulo.
- Imports de tipo con `import type`.
- En `switch` sobre uniones o enums, cubrí todos los casos y dejá un `never` en el default.
- Imports al tope del archivo, no adentro de funciones.

## Alcance de los PRs

Un cambio, un PR. Si tocás UI, describí cómo lo probaste (bandeja, prompt, dashboard y el estado vacío si aplica).
