import fsp from 'fs/promises';
import path from 'path';

// Bytes reales de los archivos de una carpeta (0 si no existe)
export async function measureFolder(folder) {
  let entries;

  try {
    entries = await fsp.readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }

  let total = 0;

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      total += await measureFolder(fullPath);
    } else if (entry.isFile()) {
      total += (await fsp.stat(fullPath)).size;
    }
  }

  return total;
}
