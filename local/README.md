# Inimigos do Traçado · sistema único (painel + administração)

```
node Ferramentas/local/server.mjs   →  http://localhost:5173
```

Uma página só, com as abas Visão geral, Corridas, Análise, Comparar voltas, Raio-X e Administração. A aba Administração aparece só para quem pode editar.

## Onde está cada coisa

| Arquivo | O que é |
|---|---|
| `app/painel.html` | Abas do painel. Agora vem de `painel_index.html`, que fica só como versão antiga |
| `app/corridas.html`, `app/corridas.js` | Aba Corridas: as folhas de cada prova (Resultado, Tomada, Volta a volta de todos), a análise da corrida e o balão do piloto |
| `app/admin.html`, `app/admin.js` | Aba Administração: cadastro, arquivos, conferência e lançamento |
| `app/leitor.js` | Lê o resultado e o volta a volta (HTML e PDF do sistema do Granja Viana) e casa os nomes |
| `app/runtime.js` | Lê o banco e entrega ao painel os datasets `resultados` e `voltas` |
| `app/build.mjs` | Junta tudo. Com `node app/build.mjs` gera `app/dist/inimigos_do_tracado.html` para publicar |
| `local/server.mjs`, `local/claude-shim.js` | Servidor local e imitação do banco e dos arquivos do claude.ai |
| `local/db/` | Banco local, uma pasta por coleção |
| `local/seed-db.mjs` | Recarrega as 13 provas históricas a partir dos CSVs conferidos |

## Banco

- `provas/pNNN`: dados da prova e arquivos enviados. `pisoLento` separa a pista no Raio-X.
- `resultados/pNNN`: `linhas: [{pos, piloto, voltas, melhor}]`. A prova só entra no painel quando este documento existe.
- `voltas/pNNN`: `linhas: [[piloto, volta, tempo_s, s1, s2, s3, valida]]`. A pista é calculada a partir da prova.
- `folhas/pNNN`: `{prova, tomada}`. Cada uma é a folha completa lida do arquivo: `{titulo, arquivo, linhas: [{pos, kart, piloto, cru, voltas, total, diff, espaco, melhor, s1, s2, s3, vel}]}`. O sistema grava a da prova ao lançar o resultado e a da tomada ao enviar o arquivo.
- `config/apelidos`: guarda como o nome aparece na folha e qual é o nome usado no painel. Aprende a cada conferência.

## Fluxo de uma prova nova

1. Nova prova.
2. Envie a Corrida: HTML ou PDF é lido na hora, e foto ou outro formato vai para a digitação.
3. Confira os nomes e clique em Lançar no painel.
4. Opcional: envie o Volta a Volta e clique em Lançar volta a volta.

As provas 4 (PDF de Interlagos) e 7 (foto) não são lidas automaticamente. Elas já estão no banco a partir dos CSVs conferidos.
