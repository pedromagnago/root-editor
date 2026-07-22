// carousel-paths: contenção de path que vale nos dois tipos de filesystem.
//
// O problema: NTFS é case-insensitive. `C:\Users\lucas\...` e `C:\Users\Lucas\...`
// são o MESMO diretório, e nem `path.resolve` nem `realpathSync` garantem
// devolver a caixa que está no disco (a letra do drive e os segmentos podem vir
// como o chamador escreveu). Comparar com `startsWith`, que é sensível a caixa,
// rejeita um caminho legítimo — e como o carrossel nunca quebra o render, o
// efeito visível é o brand pack do cliente cair no fallback da Root sem erro,
// ou a imagem do slide sumir. Falha silenciosa, no Windows, só no cliente.
//
// A dobra de caixa é aplicada SÓ em win32, de propósito. Em POSIX `/tmp/Foo` e
// `/tmp/foo` são diretórios distintos; dobrar caixa ali afrouxaria uma checagem
// que existe para barrar um slides.json hostil apontando para fora da raiz.
//
// O separador também vem da plataforma (não de `path.sep`) para que o
// comportamento win32 seja testável a partir de um host POSIX.

import nodePath from 'node:path';

function fold(value: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? value.toLowerCase() : value;
}

function separatorFor(platform: NodeJS.Platform): string {
  return platform === 'win32' ? nodePath.win32.sep : nodePath.posix.sep;
}

/** Os dois caminhos apontam para o mesmo lugar? */
export function isSamePath(
  a: string,
  b: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return fold(a, platform) === fold(b, platform);
}

/** `candidate` está ESTRITAMENTE dentro de `parentDir`? (a própria raiz é falso) */
export function isPathInside(
  parentDir: string,
  candidate: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const parent = fold(parentDir, platform);
  const child = fold(candidate, platform);
  return child !== parent && child.startsWith(parent + separatorFor(platform));
}

/** `candidate` é a própria `parentDir` ou está dentro dela? */
export function isPathAtOrInside(
  parentDir: string,
  candidate: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return isSamePath(parentDir, candidate, platform) || isPathInside(parentDir, candidate, platform);
}
