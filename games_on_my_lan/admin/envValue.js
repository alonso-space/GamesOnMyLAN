// Convierte un valor en texto seguro para el .env.
// Debe leerse igual con Node (loadEnvFile) y con Docker Compose.
export function toEnvValue(value) {
  const text = String(value);

  // Sin caracteres especiales: va sin comillas
  if (/^[A-Za-z0-9_./:@+-]*$/.test(text)) return text;

  if (/[\r\n]/.test(text)) {
    throw new Error('El valor no puede contener saltos de línea.');
  }

  // Comillas simples: ni Node ni Compose interpretan nada dentro
  if (!text.includes("'")) return `'${text}'`;

  // Con una ' dentro, solo es seguro entre comillas dobles si no hay " \ ni $
  if (!/["\\$]/.test(text)) return `"${text}"`;

  throw new Error('El valor mezcla comillas y caracteres que no se pueden guardar en el .env.');
}
