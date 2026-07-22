import { describe, expect, it } from 'vitest';

import { isPathAtOrInside, isPathInside, isSamePath } from '../src/carousel-paths.js';

// Os testes injetam a plataforma para rodarem iguais em qualquer host: o bug
// que motivou este módulo só aparece em win32 e o CI do daemon roda em Ubuntu.

describe('win32 (NTFS, case-insensitive)', () => {
  const brandsRoot = 'C:\\Users\\lucas\\.maquina-carrossel\\marcas';

  it('aceita o brand pack quando a caixa do path difere', () => {
    // O caso real: homedir() devolve uma caixa, o slides.json traz outra.
    // Antes da correção isto era `false` e o deck caía no skin da Root.
    expect(isPathInside(brandsRoot, 'C:\\Users\\Lucas\\.maquina-carrossel\\marcas\\luca', 'win32')).toBe(true);
    expect(isPathInside(brandsRoot, 'c:\\users\\lucas\\.maquina-carrossel\\marcas\\luca', 'win32')).toBe(true);
  });

  it('a própria raiz não conta como "dentro"', () => {
    expect(isPathInside(brandsRoot, 'C:\\Users\\LUCAS\\.maquina-carrossel\\marcas', 'win32')).toBe(false);
    expect(isPathAtOrInside(brandsRoot, 'C:\\Users\\LUCAS\\.maquina-carrossel\\marcas', 'win32')).toBe(true);
  });

  it('continua barrando o que está fora da raiz', () => {
    expect(isPathInside(brandsRoot, 'C:\\Windows\\System32', 'win32')).toBe(false);
    expect(isPathInside(brandsRoot, 'C:\\Users\\lucas\\.maquina-carrossel', 'win32')).toBe(false);
  });

  it('não confunde um irmão com prefixo comum', () => {
    // "marcas-backup" começa com "marcas" — sem o separador isto passaria.
    expect(isPathInside(brandsRoot, 'C:\\Users\\lucas\\.maquina-carrossel\\marcas-backup\\x', 'win32')).toBe(false);
  });

  it('isSamePath dobra a caixa', () => {
    expect(isSamePath('C:\\A\\b', 'c:\\a\\B', 'win32')).toBe(true);
  });
});

describe('posix (case-sensitive)', () => {
  const brandsRoot = '/home/pedro/.maquina-carrossel/marcas';

  it('NÃO dobra a caixa — /Foo e /foo são diretórios diferentes', () => {
    // Afrouxar isto transformaria a contenção contra slides.json hostil
    // numa checagem que aceita um diretório vizinho de nome parecido.
    expect(isPathInside(brandsRoot, '/home/Pedro/.maquina-carrossel/marcas/root', 'linux')).toBe(false);
    expect(isSamePath('/a/b', '/A/B', 'linux')).toBe(false);
  });

  it('aceita o que está de fato dentro', () => {
    expect(isPathInside(brandsRoot, '/home/pedro/.maquina-carrossel/marcas/root', 'linux')).toBe(true);
  });

  it('continua barrando escape por path relativo já resolvido', () => {
    expect(isPathInside(brandsRoot, '/etc/passwd', 'linux')).toBe(false);
    expect(isPathAtOrInside(brandsRoot, '/home/pedro/.maquina-carrossel', 'linux')).toBe(false);
  });

  it('não confunde um irmão com prefixo comum', () => {
    expect(isPathInside(brandsRoot, '/home/pedro/.maquina-carrossel/marcas-backup/x', 'linux')).toBe(false);
  });
});
