import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  validateEntryFile,
  assertPngFile,
  isValidId,
  parseOriginalAuthor,
  parseSourceUrl,
} from '../../src/utils/validators.js';

describe('validateEntryFile', () => {
  it('acepta un archivo simple .html', () => {
    expect(validateEntryFile('index.html')).toBe('index.html');
  });

  it('acepta una ruta con subcarpetas', () => {
    expect(validateEntryFile('build/juego.html')).toBe('build/juego.html');
  });

  it('rechaza intentos de path traversal', () => {
    expect(validateEntryFile('../../etc/passwd.html')).toBeNull();
  });

  it('rechaza segmentos ocultos (que empiezan con .)', () => {
    expect(validateEntryFile('.hidden/index.html')).toBeNull();
  });

  it('rechaza extensiones que no sean .html/.htm', () => {
    expect(validateEntryFile('index.js')).toBeNull();
  });

  it('rechaza valores vacíos o que no son string', () => {
    expect(validateEntryFile('')).toBeNull();
    expect(validateEntryFile(null)).toBeNull();
    expect(validateEntryFile(123)).toBeNull();
  });
});

describe('assertPngFile', () => {
  let tmpDir;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'goml-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('acepta un PNG con cabecera válida y dimensiones razonables', async () => {
    const filePath = path.join(tmpDir, 'valid.png');
    await fs.writeFile(filePath, fakePngHeader(10, 10));

    await expect(assertPngFile(filePath)).resolves.toBeUndefined();
  });

  it('rechaza un archivo que no tiene firma PNG', async () => {
    const filePath = path.join(tmpDir, 'fake.png');
    await fs.writeFile(filePath, Buffer.from('esto no es un png'));

    await expect(assertPngFile(filePath)).rejects.toThrow(/PNG válido/);
  });

  it('rechaza un PNG con dimensiones que exceden el máximo permitido', async () => {
    const filePath = path.join(tmpDir, 'huge.png');
    await fs.writeFile(filePath, fakePngHeader(9999, 9999));

    await expect(assertPngFile(filePath)).rejects.toThrow(/demasiado grande/);
  });
});

// assertPngFile solo lee los primeros 24 bytes (firma + chunk IHDR), así que
// para probarla no hace falta un PNG real y completo: basta con armar esa
// cabecera a mano con las dimensiones que queramos probar.
function fakePngHeader(width, height) {
  const header = Buffer.alloc(24);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);

  return header;
}

describe('isValidId', () => {
  it('acepta números enteros de hasta 9 dígitos', () => {
    expect(isValidId('1')).toBe(true);
    expect(isValidId('123456789')).toBe(true);
  });

  it('rechaza texto, vacío, decimales, negativos y números demasiado largos', () => {
    expect(isValidId('abc')).toBe(false);
    expect(isValidId('')).toBe(false);
    expect(isValidId('1.5')).toBe(false);
    expect(isValidId('-1')).toBe(false);
    expect(isValidId('1234567890')).toBe(false);
  });
});

describe('parseOriginalAuthor', () => {
  it('devuelve el texto sin espacios sobrantes', () => {
    expect(parseOriginalAuthor('  Atari  ')).toBe('Atari');
  });

  it('devuelve null si falta o viene vacío', () => {
    expect(parseOriginalAuthor(undefined)).toBeNull();
    expect(parseOriginalAuthor('   ')).toBeNull();
  });

  it('rechaza con status 400 lo que no es texto o es demasiado largo', () => {
    expect(() => parseOriginalAuthor(['a'])).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => parseOriginalAuthor('a'.repeat(101))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe('parseSourceUrl', () => {
  it('acepta http y https y devuelve la URL normalizada', () => {
    expect(parseSourceUrl('  https://github.com/usuario/repo  ')).toBe(
      'https://github.com/usuario/repo',
    );
    expect(parseSourceUrl('http://ejemplo.com')).toBe('http://ejemplo.com/');
  });

  it('devuelve null si falta o viene vacío', () => {
    expect(parseSourceUrl(undefined)).toBeNull();
    expect(parseSourceUrl(null)).toBeNull();
    expect(parseSourceUrl('   ')).toBeNull();
  });

  it('rechaza con status 400 los esquemas que no son http/https', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://ejemplo.com/juego',
      'file:///etc/passwd',
    ]) {
      expect(() => parseSourceUrl(value)).toThrow(expect.objectContaining({ status: 400 }));
    }
  });

  it('rechaza con status 400 texto que no es una URL, no-strings y URLs con credenciales', () => {
    expect(() => parseSourceUrl('github.com/usuario/repo')).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(() => parseSourceUrl(['https://a.com'])).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(() => parseSourceUrl('https://usuario:clave@ejemplo.com')).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('rechaza con status 400 una URL demasiado larga', () => {
    expect(() => parseSourceUrl(`https://ejemplo.com/${'a'.repeat(500)}`)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});
