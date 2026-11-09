import { describe, it, expect } from 'vitest';
import { parseEnv } from 'node:util';
import { toEnvValue } from '../../admin/envValue.js';

// Escribe el valor como lo haría el instalador y lo vuelve a leer con el parser real de Node
const roundTrip = (value) => parseEnv(`PW=${toEnvValue(value)}`).PW;

describe('toEnvValue', () => {
  it.each([
    'simple123',
    'con espacio',
    'tiene#hash',
    'comilla"doble',
    'back\\slash',
    'dolar$HOME',
    "apos'trofo",
    'a"b\\c#d$e',
  ])('se lee igual que se escribió: %s', (password) => {
    expect(roundTrip(password)).toBe(password);
  });

  it('nunca deja un $ entre comillas dobles, para que Compose no lo interpole', () => {
    // Con ' y $ juntos no hay forma segura: debe rechazarlo en vez de usar comillas dobles
    expect(() => toEnvValue("it's $HOME")).toThrow();
    expect(toEnvValue('dolar$HOME')).toBe("'dolar$HOME'");
  });

  it('rechaza lo que no puede guardar de forma segura', () => {
    expect(() => toEnvValue(`mezcla'"`)).toThrow();
    expect(() => toEnvValue('con\nsalto')).toThrow();
  });
});
