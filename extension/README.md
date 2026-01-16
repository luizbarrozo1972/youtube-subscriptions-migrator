# YouTube Subscriptions Importer

Extensao do Chrome para importar inscricoes do YouTube via CSV usando a YouTube Data API.

## Requisitos
- Conta do Google com acesso ao YouTube.
- Projeto no Google Cloud com a YouTube Data API habilitada.
- Um OAuth Client ID do tipo Chrome App vinculado ao ID da extensao.

## Configuracao
1) Carregue a extensao sem empacotar em chrome://extensions (Developer mode).
2) Copie o Extension ID.
3) No Google Cloud Console:
   - Crie um OAuth Client ID do tipo Chrome App.
   - Informe o Extension ID.
   - Habilite a YouTube Data API para o projeto.
4) Edite o arquivo manifest.json e substitua YOUR_CLIENT_ID pelo Client ID.

## Uso
1) Abra a extensao e carregue o CSV.
2) Defina o atraso entre inscricoes.
3) Clique em Iniciar e autorize o acesso.

## Observacoes
- O CSV deve ter coluna com ID do canal ou URL contendo /channel/UC....
- URLs no formato /@handle nao sao resolvidas automaticamente.
