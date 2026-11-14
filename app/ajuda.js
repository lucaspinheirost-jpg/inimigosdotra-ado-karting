// "i" de cada página: explicação curta de como ler o painel. Abre num diálogo (no celular, sobe por baixo).
(() => {
  const AJUDA = {
    geral: {
      titulo: 'Como ler a Visão geral',
      itens: [
        ['Cartões do topo', 'Quem lidera o campeonato e com quantos pontos de vantagem, quantas provas já foram, quantos pilotos correram e quem tem mais vitórias.'],
        ['Campeonato', 'Pontos como na Fórmula 1: 1º = 25, 2º = 18, 3º = 15, 4º = 12, 5º = 10, 6º = 8, 7º = 6, 8º = 4, 9º = 2, 10º = 1. Soma todas as provas. Use Top 10 / Top 20 para ver mais nomes.'],
        ['Quem mais corre', 'Quantas provas cada piloto disputou.'],
        ['Vitórias e pódios', 'Barra escura = vitórias. Barra clara = 2º e 3º lugares.'],
        ['Provas da temporada', 'Vencedor e volta mais rápida de cada prova. "Grid" é quantos pilotos correram.'],
      ],
    },
    corridas: {
      titulo: 'Como ler as Corridas',
      itens: [
        ['Escolher a prova', 'Use a lista ou as setas ‹ › ao lado dela.'],
        ['Resultado', 'A folha oficial do kartódromo. "Dif. p/ 1º" é a distância para o vencedor e "Dif. p/ frente" para quem chegou logo à frente. "1 volta" quer dizer que levou uma volta. Melhor volta da prova em azul.'],
        ['Tomada de tempo', 'A classificação antes da prova. O 1º é a pole.'],
        ['Volta a volta', 'Um bloco por piloto, na ordem de chegada. Amarelo = volta mais rápida da prova. Azul = melhor volta do piloto. Riscada = falha de cronometragem, não conta. "Dif." = quanto a volta ficou acima da melhor dele.'],
        ['Balão do piloto', 'Toque no nome para abrir. Ritmo médio é a média das voltas limpas, sem a 1ª e sem voltas atrapalhadas. Constância mostra o quanto os tempos variam: quanto menor, melhor. Volta ideal é a soma dos melhores trechos.'],
        ['Histórico no balão', 'Só compara com corridas iguais: mesmo kartódromo, mesmo traçado e mesma pista (seca com seca, molhada com molhada). Verde: melhor que a média dele. Vermelho: pior.'],
        ['Análise da corrida', 'Barras verdes = posições ganhas da tomada até a chegada. Vermelhas = perdidas. No ritmo, bolinha azul é a melhor volta e a branca é o ritmo médio. Mais à esquerda é mais rápido.'],
      ],
    },
    analise: {
      titulo: 'Como ler a Análise',
      itens: [
        ['Compare dois pilotos', 'Escolha o Piloto A e o Piloto B. O placar mostra quantas vezes cada um chegou na frente do outro nas provas em que correram juntos.'],
        ['Gráfico de chegadas', 'A posição de chegada em cada prova, com P1 no topo. A barra cinza é o tamanho do grid naquela prova.'],
        ['Todos os pilotos', 'Toque no título de uma coluna para ordenar e num piloto para comparar. "Pos. média" é a média das posições de chegada. "Melhor" é a melhor posição que ele já fez.'],
      ],
    },
    voltas: {
      titulo: 'Como ler o Comparar voltas',
      itens: [
        ['Dois jeitos de comparar', '"Pilotos numa prova": até 4 pilotos na mesma corrida. "Provas de um piloto": o mesmo piloto em até 4 corridas.'],
        ['Tempo de cada volta', 'Cada ponto é uma volta. Quanto mais baixo, mais rápido. O ponto maior é a melhor volta.'],
        ['Resumo', 'Ritmo médio é a média das voltas limpas. Consistência (± segundos) mostra quanto os tempos variam: quanto menor, mais constante. Volta ideal é a soma dos melhores trechos.'],
        ['Setores', 'A volta é dividida em 3 trechos (S1, S2, S3). Em azul o mais rápido de cada trecho; ao lado, quanto cada um perde para ele.'],
        ['Dica', 'Compare corridas da mesma pista e na mesma condição. Pista molhada é bem mais lenta.'],
      ],
    },
    raiox: {
      titulo: 'Como ler o Raio-X',
      itens: [
        ['Começo', 'Digite seu nome e escolha a pista. Os números são só daquela pista.'],
        ['Sua volta ideal', 'A soma dos seus melhores trechos. A diferença para a sua melhor volta é o tempo que você ainda pode ganhar.'],
        ['Onde você perde tempo', 'Seus trechos comparados com a referência: o recorde da pista ou o melhor do núcleo (pilotos com 5 ou mais provas).'],
        ['Sua evolução', 'Sua melhor volta em cada prova nesta pista. Linha descendo = você está mais rápido.'],
        ['Trecho a trecho', 'Seu melhor e sua média em cada trecho, só nas voltas limpas.'],
      ],
    },
  };

  const NOMES = { geral: 'Visão geral', corridas: 'Corridas', analise: 'Análise', voltas: 'Comparar voltas', raiox: 'Raio-X' };
  const dlg = document.createElement('dialog');
  dlg.className = 'idt-ajuda';
  dlg.setAttribute('aria-labelledby', 'idt-ajuda-tit');
  document.querySelector('.idt').append(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  function abrir(pg) {
    const a = AJUDA[pg];
    if (!a) return;
    dlg.replaceChildren();
    const head = document.createElement('div'); head.className = 'idt-ajuda-head';
    const h = document.createElement('h2'); h.id = 'idt-ajuda-tit'; h.textContent = a.titulo;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'idt-btn ghost idt-ajuda-x'; x.setAttribute('aria-label', 'Fechar'); x.textContent = '×'; x.onclick = () => dlg.close();
    head.append(h, x);
    const dl = document.createElement('dl');
    for (const [t, d] of a.itens) { const dt = document.createElement('dt'); dt.textContent = t; const dd = document.createElement('dd'); dd.textContent = d; dl.append(dt, dd); }
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'idt-btn primary'; ok.textContent = 'Entendi'; ok.onclick = () => dlg.close();
    dlg.append(head, dl, ok);
    dlg.showModal();
    ok.focus();
  }

  const botao = (pg) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'idt-info'; b.textContent = 'i';
    b.setAttribute('aria-label', 'Como ler a página ' + NOMES[pg]); b.title = 'Como ler esta página';
    b.addEventListener('click', () => abrir(pg));
    return b;
  };

  // coloca o "i" ao lado do título de cada página (a Visão geral ganha uma linha de título curta)
  for (const pg of Object.keys(AJUDA)) {
    const sec = document.querySelector(`[data-page="${pg}"]`);
    if (!sec) continue;
    let h2 = sec.querySelector('.idt-sechead h2');
    if (!h2 && pg === 'corridas') { const alvo = sec.querySelector('.cor-linha'); if (alvo) alvo.append(botao(pg)); continue; }
    if (!h2) {
      const head = document.createElement('div'); head.className = 'idt-sechead';
      h2 = document.createElement('h2'); h2.textContent = NOMES[pg];
      head.append(h2); sec.prepend(head);
    }
    const linha = document.createElement('div'); linha.className = 'idt-titulo';
    h2.replaceWith(linha); linha.append(h2, botao(pg));
  }
  window.IDTAjuda = { abrir };
})();
