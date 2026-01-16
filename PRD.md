# PRD - Migracao de inscricoes do YouTube

## Contexto
Usuario possui uma exportacao em CSV com inscricoes de canais do YouTube e deseja importar essas inscricoes para outra conta.

## Objetivo
Criar uma extensao do Chrome que importe inscricoes a partir de um CSV, automatizando a inscricao em canais na conta de destino.

## Descobertas (baseadas em documentacao oficial)
- O Google Takeout permite baixar dados, mas nao fornece mecanismo oficial de importacao entre contas.
- Ha um fluxo oficial para mover um canal entre Brand Accounts (transfere o canal), mas isso nao migra inscricoes entre contas pessoais.
- O YouTube Data API possui endpoints para criar inscricoes e playlists:
  - "Subscriptions: insert" (YouTube Data API)
  - "Playlists: insert" (YouTube Data API)
  - "PlaylistItems: insert" (YouTube Data API)

## Requisitos funcionais
- Importar um arquivo CSV com lista de canais (URL ou ID).
- Validar e deduplicar canais antes de iniciar.
- Inscrever automaticamente na conta de destino.
- Permitir configurar o ritmo de inscricao (ex.: 1 canal a cada X segundos).
- Mostrar progresso e logs de sucesso/falha.
- Permitir pausar/retomar o processo.

## Requisitos nao funcionais
- Evitar caracteres nao-ASCII quando possivel.
- Respeitar limites e reduzir risco de bloqueio (ritmo configuravel).
- Nao exigir credenciais do usuario (usuario loga manualmente no Chrome).

## Opcao de implementacao
1) Automacao via interface do YouTube:
   - Extensao abre canal e clica em "Inscrever-se".
   - Requer que o usuario esteja logado na conta destino.
   - Mais simples, sem OAuth.

2) Via YouTube Data API (futuro):
   - Requer OAuth/Google Cloud.
   - Permite criar inscricoes via API.

## Riscos
- Bloqueio por automacao se o ritmo for agressivo.
- Variacoes de layout do YouTube podem quebrar seletores.
- CSV pode ter formatos diferentes (precisa sample real).

## Pendencias para iniciar
- Amostra do CSV (cabecalho e 3-5 linhas).
- Confirmacao do metodo (automacao no site vs API).
- Ritmo desejado de inscricao.
