# Listado de fondos

Desde esta carpeta:

```sh
npm ci
npm test
npm run build
npm run dev
```

Las pruebas cubren la ordenación entre columnas y los valores ausentes, la selección
de hasta cinco fondos o planes, el bloqueo entre tipos, los enlaces de Morningstar
y Finect, los mensajes visibles y la advertencia de identificadores duplicados.
Se ejecutan también en GitHub Actions para las PR que modifican esta aplicación.

La advertencia de la cabecera comprueba todos los productos cargados, incluidos los
ocultos por la búsqueda. Enumera los ISIN y MorningstarId repetidos y los fondos o
planes afectados, incluso si la coincidencia está entre ambas secciones. No corrige
ni modifica automáticamente `config/fondos.yaml`.
