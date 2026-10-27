# Circuito 3 — transformación acuática

Marina Bay conserva sus waypoints y la lógica de carrera, junto con asfalto, curvas, bordillos, señalización, parrilla, barreras, vallas e iluminación. Se han retirado del montaje activo el contexto urbano y su suelo, los bloques de ciudad, los hitos y skyline, las gradas/pabellones y los edificios del pit. Se mantienen el pit apron y el muro con su colisionador, pero ya no se generan edificios ni colisiones fantasma de garajes.

La bahía recortada se sustituyó por una superficie oceánica continua de 6 km × 6 km bajo y alrededor de todo el trazado. El nivel de mar permanece en Y=-0,45 m frente a la calzada en Y=0,02 m, una separación de 0,47 m que mantiene el asfalto seco y deja el agua visible desde la pista. El agua tiene paleta azul oceánica y conserva las ondas y los reflejos; no se genera suelo urbano ni lecho visible debajo del circuito.

El asfalto de C3 usa el conjunto PBR `asphalt_02_2k` adjunto: albedo, normales y rugosidad a 2048 × 2048, con repetición moderada a lo largo de la calzada. Los mapas se cargan en el material exclusivo de C3; los circuitos 1 y 2 no comparten ni reciben estas texturas.

Validación realizada con `npm run lint` y `npm run build -- --base=./`. Las capturas aéreas de antes/después usan la misma cámara, y se añadió una captura a nivel de pista para comprobar la visibilidad del agua.

## Adjuntos integrados en C3

- `kloofendal_48d_partly_cloudy_puresky_2k.hdr` (Radiance RGBE, 2048 × 1024): se convierte a PMREM para la iluminación ambiental y los reflejos PBR, y el HDR original se usa además como cielo visible solo mientras está activo Marina Bay. La luz directa y el relleno ambiental de C3 se reducen y equilibran para evitar lavar el aspecto diurno; Circuit 1 y Circuit 2 conservan su entorno original. Si no carga el HDR, se mantiene el cielo de respaldo.
- `dutch_ship_large_01_2k.gltf.zip`: se sirve como GLTF con sus tres mallas originales —casco, aparejo y velas—, 110.616 triángulos y los nueve mapas 2K de color, normales y metalness/roughness. El velero queda en el exterior de una recta larga, junto al muro, en torno a `(270, -92)`, para que se vea desde el coche al pasar sin invadir la pista. La huella está fuera del trazado y su punto más cercano queda a 15,6 m del centrolineado (3,1 m más allá de la huella del firme); hay 100,7 m de separación conservadora respecto de la embarcación más próxima y 290,2 m respecto del perímetro de seguridad de la noria. No añade luces, cámaras de reflejo ni casters de sombra.

La carga del modelo es asíncrona y sus recursos se liberan al cerrar el constructor de C3. Los archivos de origen permanecen intactos; no se alteran trazado, física ni otros circuitos.
