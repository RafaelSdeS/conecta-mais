/** Imprime só a folha ligada à classe no <body> (regras em index.css); desfaz ao fechar a impressão. */
export function imprimir(classe: 'imprimindo-ficha' | 'imprimindo-dossie') {
  document.body.classList.add(classe)
  window.addEventListener('afterprint', () => document.body.classList.remove(classe), { once: true })
  window.print()
}
