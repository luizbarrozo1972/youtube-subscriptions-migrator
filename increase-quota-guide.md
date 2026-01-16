# Guia para Aumentar a Quota da YouTube Data API

## Situação Atual
- **Quota Atual**: 10.000 unidades/dia (padrão gratuito)
- **Objetivo**: 15.000 unidades/dia (5.000 a mais)

## Limite do gcloud CLI
O gcloud CLI só permite ajustes via override até 10.000 unidades/dia. Para valores acima, é necessário fazer uma solicitação formal pelo Console do Google Cloud.

## Opção 1: Via Console do Google Cloud (Recomendado)

1. Acesse o Console de Quotas:
   ```
   https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas?project=yt-subs-migrator-260116110242
   ```

2. Encontre a quota "Queries per day" (unidade: 1/d/{project})

3. Clique em "EDIT QUOTAS" ou "REQUEST INCREASE"

4. Solicite aumento para **15.000 unidades/dia**

5. Preencha o formulário:
   - **Quota name**: Queries per day
   - **Current limit**: 10.000
   - **Requested limit**: 15.000
   - **Justification**: (See detailed justification below)

## Detailed Justification for Quota Increase

Use the following justification (approximately 300 words) when requesting the quota increase:

---

**Justification for YouTube Data API Quota Increase Request**

We are requesting an increase in the daily quota from 10,000 to 15,000 units per day for our YouTube subscriptions migration tool. This application enables users to migrate their YouTube channel subscriptions between accounts by programmatically creating subscriptions via the YouTube Data API v3.

Our application processes subscription migrations by calling the `subscriptions.insert` endpoint, which consumes 50 quota units per operation. With the current default quota of 10,000 units per day, we can process approximately 200 subscriptions daily. However, many users who need to migrate subscriptions have significantly larger subscription lists, often ranging from 500 to 2,000 or more channels.

The requested increase to 15,000 units per day would allow us to process approximately 300 subscriptions per day, significantly improving the user experience by reducing the migration time for larger subscription lists. This increase remains within reasonable usage limits and follows YouTube API best practices, including appropriate rate limiting between requests to avoid service disruption.

This quota increase will benefit users who are consolidating their YouTube accounts, switching to new accounts, or recovering subscriptions from account exports. Our application implements proper error handling, respects API rate limits, and ensures data privacy by processing all operations through authenticated user sessions with their explicit consent.

We believe this modest increase will enable a more practical and efficient migration process while remaining well within acceptable usage patterns. The application serves a legitimate need for users to manage their YouTube subscription data, and the increased quota will help provide a better user experience without placing undue burden on YouTube's infrastructure.

We appreciate your consideration of this request and are committed to using the YouTube Data API responsibly and in accordance with Google's terms of service.

---

6. Envie a solicitação e aguarde aprovação (geralmente 24-48 horas)

## Opção 2: Via API REST (Alternativa)

Você pode criar uma solicitação usando a API do Service Usage. Isso requer autenticação e permissões apropriadas.

## Notas Importantes

- **Custos**: A YouTube Data API v3 é gratuita até 10.000 unidades/dia. Acima disso, pode haver custos. No entanto, 15.000 ainda está na faixa gratuita para a maioria dos casos de uso.
- **Tempo de Aprovação**: Solicitações de aumento geralmente são aprovadas em 24-48 horas.
- **Unidades por Operação**: 
  - `subscriptions.insert` = 50 unidades
  - Com 15.000 unidades/dia, você pode fazer ~300 inscrições/dia

## Verificar Status da Solicitação

Após enviar a solicitação, você pode verificar o status no mesmo console ou via:

```bash
gcloud alpha services quota list --service=youtube.googleapis.com --consumer=projects/yt-subs-migrator-260116110242
```
