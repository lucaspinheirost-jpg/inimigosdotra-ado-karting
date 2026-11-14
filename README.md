# Inimigos do Traçado · Painel da temporada

Painel do campeonato de kart Inimigos do Traçado. Ele mostra a classificação, as corridas (resultado, tomada de tempo e volta a volta), a análise de cada piloto e o Raio-X.

- **Público:** abre o site e vê tudo, sem login.
- **Administrador:** entra por "Área do administrador" no rodapé e lança as provas na aba Administração.

## Como funciona

| Parte | Onde |
|---|---|
| Página (uma só) | `app/` → `node app/build.mjs` gera `app/dist/index.html` |
| Dados e arquivos | Supabase: tabela `docs` e bucket `arquivos`. As regras estão em `supabase/schema.sql` |
| Login do admin | Supabase Auth (e-mail e senha). Só quem está na tabela `admins` pode editar |
| Hospedagem | Vercel: build `node app/build.mjs`, saída `app/dist` (veja `vercel.json`) |

A configuração do Supabase (URL e chave pública "anon") fica em `app/supabase.config.json` ou nas variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`. A chave anon é pública por natureza; quem protege os dados são as regras do banco.

## Desenvolver no computador

```
node local/server.mjs              # http://localhost:5173 com o banco local (local/db)
node local/server.mjs --supabase   # mesma página, usando o Supabase de verdade
```

Veja `local/README.md` para o formato do banco e o fluxo de lançamento de uma prova.

## Arquivos de `app/`

| Arquivo | O que é |
|---|---|
| `painel.html` | Abas Visão geral, Análise, Comparar voltas e Raio-X |
| `corridas.html`, `corridas.js` | Aba Corridas: folhas da prova, volta a volta por piloto e balão de análise |
| `admin.html`, `admin.js` | Aba Administração |
| `leitor.js` | Lê os arquivos do kartódromo (HTML e PDF) |
| `runtime.js` | Lê o banco e monta os dados do painel |
| `ajuda.js` | O "i" de cada página |
| `conta.js` | Rodapé e login do administrador |
| `supabase-shim.js` | Ligação com o Supabase |
