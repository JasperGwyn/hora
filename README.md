# Hora

App de Windows para medir a qué proyecto le dedicás el tiempo. Vive en la bandeja del sistema y no interrumpe mientras trabajás.

## Cómo funciona

1. Cargás los nombres de los proyectos en los que estás trabajando.
2. Hora corre en segundo plano y mira si la computadora se está usando de verdad (teclado/mouse). El tiempo idle no cuenta.
3. Al terminar cada hora del reloj (por ejemplo 14:00–15:00) te pregunta a qué proyecto le dedicaste el tiempo de uso real.
4. Si en esa hora no usaste la computadora, no pregunta.

Cerrar la ventana no cierra la app: queda en la bandeja. Para salir del todo, clic derecho en el icono → **Salir**.

## Desarrollo

```bash
npm install
npm run dev
```

Para probar la pregunta sin esperar al cierre de hora: clic derecho en la bandeja → **Probar pregunta de esta hora**.

```bash
npm run check-all
npm run dist
```

`npm run dist` genera el instalador en `dist/`.
