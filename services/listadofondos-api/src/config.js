import { parseDocument } from "yaml";

export function parseConfigYaml(text) {
  const document = parseDocument(text);
  if (document.errors.length) throw new Error(`Configuración YAML incorrecta: ${document.errors[0].message}`);
  const data = document.toJS();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("La configuración debe contener funds y plans.");
  if (!("funds" in data) && !("plans" in data)) throw new Error("La configuración debe contener funds o plans.");
  const result = {};
  for (const section of ["funds", "plans"]) {
    const items = data[section] ?? [];
    if (!Array.isArray(items)) throw new Error(`${section} debe ser una lista.`);
    result[section] = items.map((entry, index) => {
      const label = `${section}[${index + 1}]`;
      if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.name !== "string" || !entry.name.trim()) {
        throw new Error(`${label}: falta un nombre válido.`);
      }
      const product = { name: entry.name.trim() };
      for (const field of ["isin", "morningstarId", "category", "comment"]) {
        const value = entry[field];
        if (value != null && typeof value !== "string") throw new Error(`${label} (${product.name}): ${field} debe ser texto.`);
        product[field] = value?.trim() ?? "";
      }
      for (const field of ["indexed", "inPortfolio"]) {
        const value = entry[field];
        if (value != null && typeof value !== "boolean") throw new Error(`${label} (${product.name}): ${field} debe ser true o false.`);
        product[field] = value ?? false;
      }
      return product;
    });
  }
  return result;
}
