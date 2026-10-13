# API del listado de fondos

```sh
npm ci
npm test
npm start
```

Las pruebas usan ficheros y servidores HTTP temporales, sin consultar Morningstar
ni alterar el archivo de fondos del usuario. Cubren decimales, tablas parciales,
identificación de la columna del fondo, periodos de riesgo, YAML, conservación de
métricas, actualización concurrente y cabeceras de caché.

La API mantiene su caché interna durante cuatro horas. Las respuestas HTTP llevan
`Cache-Control: no-store` para que el navegador observe correctamente los cambios
de `isUpdating`. Un fallo de actualización mantiene el último resultado válido,
devuelve `updateFailed` y deja de señalar una actualización en curso. El botón de
reintento solicita explícitamente una nueva actualización.

Las consultas de rentabilidad, riesgo y comisiones se procesan por separado.
Cada periodo o métrica válido sustituye al anterior; los que no se pudieron leer
conservan su cifra y fecha anterior. `metricUpdatedAt` guarda las fechas por métrica
y periodo, `isStale` indica resultados pendientes y `lastUpdated` indica la última
comprobación, no la fecha de todas las cifras. El guardado de caché es atómico.

La configuración se lee con YAML estándar y se valida antes de sobrescribir la
caché. No se modifica `apps/listadofondos/config/fondos.yaml`.
