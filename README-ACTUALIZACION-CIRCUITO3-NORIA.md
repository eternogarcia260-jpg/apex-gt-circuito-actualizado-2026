# Circuito 3 · Noria en el agua interior

La noria del archivo adjunto ya está integrada en Marina Bay, dentro del perímetro del circuito. Los barcos, el trazado, las barreras y la física existentes se mantienen. La nueva construcción se añade después de la escena y la flota para no alterar sus semillas ni sus ajustes de sombras.

## Modelo completo, no una sustitución simplificada

Se conserva directamente la construcción geométrica del HTML original: radio de 28,7 m, eje a 35,2 m, 32 cabinas, estructura doble, radios, piezas del eje, plataforma, materiales PBR y luces emisivas. El giro es de 0,035 rad/s sobre el eje Z; las cabinas permanecen verticales.

Solo se elimina el entorno independiente del adjunto —su suelo de cemento, cámara, renderer, iluminación y bucle propios— para utilizar los del juego. Se añaden cuatro pilotes bajo los pies originales para conectar la plataforma rígida al agua, sin hacerla flotar ni añadir cuerpos físicos.

## Ubicación y márgenes

El origen del modelo está en X=-100, Y=0, Z=-40; el nivel medio del agua es Y=-1,25. La envolvente horizontal conservadora de 33 m queda íntegramente dentro del circuito. Conserva 82,60 m de agua libre hasta el borde de la plataforma vial y 168,23 m hasta la envolvente conservadora del barco más próximo, R12.

## Organización y coste

La geometría completa suma 511.672 triángulos lógicos, 26 geometrías y 12 materiales, organizados en 26 lotes de dibujo. Las cabinas opacas comparten geometría mediante instancias; el vidrio usa un BatchedMesh con ordenación y recorte por cada cámara real, incluida la del reflejo del agua. No se añaden luces, cámaras de reflejo ni bucles de renderizado.

Los 26 lotes no equivalen a 26 llamadas totales por fotograma: también intervienen sombras y reflejos. En el encuadre oblicuo fijo, el contador conjunto del renderer pasó de 184 a 254 llamadas. Estas mediciones de inspección no son una promesa de FPS en móviles.

## Pruebas y capturas

Superados TypeScript, compilación, regresión del lago, regresión geométrica de la flota y pruebas específicas del modelo y su emplazamiento. Estas últimas verifican vértices reales durante el giro, jerarquía completa de cabinas, verticalidad, materiales, límites, capas de reflejo y liberación de cada recurso exactamente una vez.

Cobertura de los tres módulos de noria: **99,64 % de líneas, 94,41 % de ramas y 100 % de funciones**. Los logs y el resumen de cobertura están en `docs/validation/noria-2026-10-26/`.

Las comparaciones emplean el motor real, la misma cámara, construcción aleatoria fijada, iluminación, agua y barcos en t=8 s y resolución 1280×649. Son capturas auténticas: las comparativas solo concatenan los píxeles, con **antes arriba y después abajo**, sin retoque de la escena.

- [Comparativa interior oblicua](docs/validation/noria-2026-10-26/comparativa-antes-despues-oblicua.png)
- [Comparativa desde la pista](docs/validation/noria-2026-10-26/comparativa-antes-despues-desde-pista.png)

La consola de inspección no registró errores del modelo o sus shaders. Sí registra el fallo del WebSocket de recarga automática de Vite a través del túnel de vista previa; se utilizó recarga manual. La compilación conserva la advertencia del proyecto sobre el tamaño del bundle.

## Abrir y reproducir

```bash
npm ci
npm run dev
# Visor de inspección en modo desarrollo: /ferris-wheel-audit.html
npm run test:ferris-wheel
npm run lint
npm run build
```

El HTML original permanece intacto en `docs/sources/noria_optimizada.html`. Su SHA-256 coincide con el adjunto: `6b70cdcef42df3f3c892ad9481cf3cf3a5271b0df2633f6846aa3368c80b8f70`.

La construcción se puede regenerar sin cambios mediante `python3 scripts/extract-ferris-wheel-model.py`. El código de integración está en `SingaporeFerrisWheel.ts`, `FerrisWheelPrototype.js`, `SingaporeFerrisWheelLayout.ts` y las adiciones acotadas de `SingaporeTrackBuilder.ts`, dentro de `src/game/circuits/singapore/`.
