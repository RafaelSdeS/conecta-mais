/**
 * Carrega módulos TypeScript puros nos testes: transpila cada arquivo, remove os imports relativos
 * (os módulos passados já vêm em ordem de dependência) e importa o resultado concatenado.
 */
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

export async function carregaTs(...caminhos) {
  const partes = []
  for (const caminho of caminhos) {
    const fonte = await readFile(new URL(`../src/${caminho}`, import.meta.url), 'utf8')
    const { outputText } = ts.transpileModule(fonte, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    partes.push(outputText.replace(/^import .* from '\.{1,2}\/.*';?\s*$/gm, ''))
  }
  const url = `data:text/javascript;base64,${Buffer.from(partes.join('\n')).toString('base64')}`
  return import(url)
}
