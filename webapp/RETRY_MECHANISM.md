# Mecanismo de Retry Automático para Erros de Quota

## O que foi implementado

### 1. Schema atualizado (Prisma)
- Adicionado campo `errorType` (TEXT) para classificar tipos de erro
- Adicionado campo `lastErrorAt` (TIMESTAMP) para rastrear quando o erro ocorreu
- Índice adicionado para otimizar buscas por `errorType` e `status`

### 2. Classificação de Erros
Função `classifyError()` que identifica:
- **QUOTA**: Erros de quota excedida (403, 429, mensagens contendo "quota" ou "exceeded")
- **AUTH**: Erros de autenticação (401) - retry após refresh token
- **NETWORK**: Erros de rede (timeouts, conexão perdida) - retry automático
- **PERMANENT**: Erros permanentes (400, 404, 500+) - não retry
- **UNKNOWN**: Outros erros - não retry

### 3. Reset Automático de Erros de Quota
Função `resetQuotaErrors()` que:
- Identifica erros de quota com mais de 4 horas desde o último erro
- Reseta status de `ERROR` para `PENDING`
- Limpa `errorType` e `lastErrorAt`
- Permite reprocessamento automático

### 4. Verificação e Retomada Automática
Função `checkAndResumeQuotaErrors()` que:
- Verifica se há sucessos recentes (última hora) indicando quota resetada
- Reseta automaticamente erros de quota antigos
- Retoma processamento se estava pausado por quota

### 5. Processamento Inteligente
- `processNext()` agora:
  - Verifica periodicamente se quota resetou (a cada 10 tentativas)
  - Processa erros retryáveis automaticamente
  - Pausa automaticamente quando quota excedida
  - Agenda verificação periódica (30 minutos) para retomar quando quota resetar
  - Limpa timers corretamente ao finalizar

### 6. Endpoints API Adicionados

#### `POST /api/imports/:id/retry-quota-errors`
- Reseta manualmente erros de quota para retry
- Retoma processamento se estava pausado
- Retorna quantidade de erros resetados

#### `POST /api/imports/:id/auto-resume`
- Verifica e tenta retomar processamento automaticamente
- Retorna se foi retomado com sucesso

#### `GET /api/imports/:id` (atualizado)
- Agora retorna estatísticas de retry:
  - `retry.quotaErrors`: Número de erros de quota
  - `retry.networkErrors`: Número de erros de rede
  - `retry.authErrors`: Número de erros de autenticação
  - `retry.pendingCount`: Canais pendentes
  - `retry.paused`: Se o processamento está pausado

## Como Funciona

### Fluxo de Erro de Quota

1. **Erro detectado**: Quando uma requisição retorna erro de quota
   - Canal é marcado como `ERROR` com `errorType: 'QUOTA'`
   - `lastErrorAt` é atualizado com timestamp atual
   - Worker é pausado automaticamente

2. **Verificação periódica**: 
   - Sistema verifica a cada 30 minutos se quota resetou
   - Se detectar sucessos recentes (última hora), assume que quota resetou

3. **Reset automático**:
   - Erros de quota com mais de 4 horas são resetados para `PENDING`
   - Worker é automaticamente retomado
   - Processamento continua do ponto onde parou

### Comportamento

- **Pausa automática**: Quando quota excedida, o sistema pausa e aguarda reset
- **Retomada automática**: Quando quota resetar, o sistema detecta e retoma automaticamente
- **Sem perda de dados**: Todos os canais com erro de quota são preservados e reprocessados
- **Retry inteligente**: Apenas erros retryáveis são reprocessados (QUOTA, NETWORK, AUTH)

## Próximos Passos

1. **Regenerar Prisma Client** (após reiniciar servidor se necessário):
   ```bash
   cd webapp
   npx prisma generate
   ```

2. **Atualizar erros existentes**:
   ```bash
   cd webapp
   node update-existing-errors.js
   ```

3. **Reiniciar servidor** para aplicar mudanças

## Notas

- O sistema detecta automaticamente quando a quota resetou (meia-noite PST / 04:00 BRT)
- Não é necessário intervenção manual para retomar processamento
- Todos os canais que falharam por quota serão automaticamente reprocessados
- A cada 200 inscrições bem-sucedidas (~10.000 unidades), o sistema pausará e aguardará o próximo dia
