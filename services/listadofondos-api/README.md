# listadofondos API

## Depuración del parseo de rentabilidades

Puedes inspeccionar el texto que genera Morningstar y la información que recoge el parser sin tener que levantar toda la API.

1. Guarda el HTML del snapshot (por ejemplo, con tu navegador o `curl`).
2. Ejecuta el script de depuración apuntando al fichero descargado:
   ```bash
   cd services/listadofondos-api
   npm run debug:performance -- \
     --file /ruta/al/snapshot.html \
     --text /tmp/snapshot.txt \
     --block /tmp/rentabilidades.txt \
     --log
   ```
   * `--file` o `--url` indican la fuente de HTML.
   * `--text` y `--block` son opcionales y guardan, respectivamente, el texto plano completo y el bloque detectado para "Rentabilidades acumuladas".
   * `--log` muestra los mensajes de depuración en consola.
3. El script genera un JSON con `values` (los datos parseados) y `debug` (motivo de fallo, fragmentos, etc.). Si `debug.reason` no es `null` el comando devolverá código de salida distinto de cero.

También puedes activar los logs en el servidor ejecutándolo con `DEBUG_PERFORMANCE=1`:
```bash
DEBUG_PERFORMANCE=1 npm start
```
Esto añadirá mensajes `[performance] …` en consola con el estado del parser durante las peticiones reales.
