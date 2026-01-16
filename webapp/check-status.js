const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const runs = await prisma.importRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (runs.length === 0) {
      console.log('Nenhum run encontrado');
      await prisma.$disconnect();
      return;
    }

    const run = runs[0];
    console.log('=== ULTIMO RUN ===');
    console.log('ID:', run.id);
    console.log('Status:', run.status);
    console.log('Total:', run.total);
    console.log('Processados:', run.processed);
    console.log('Sucesso:', run.success);
    console.log('Erros:', run.error);
    console.log('Iniciado em:', run.startedAt);
    console.log('');

    // Últimos erros
    const errors = await prisma.channelEntry.findMany({
      where: { runId: run.id, status: 'ERROR' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    console.log('=== ULTIMOS ERROS (Top 10) ===');
    errors.forEach((e) => {
      const msg = e.errorMessage ? e.errorMessage.substring(0, 150) : 'Sem mensagem';
      console.log(`- ${e.channelId}: ${msg}`);
    });
    console.log('');

    // Último sucesso
    const lastSuccess = await prisma.channelEntry.findFirst({
      where: { runId: run.id, status: 'SUCCESS' },
      orderBy: { updatedAt: 'desc' },
    });

    console.log('=== ULTIMO SUCESSO ===');
    if (lastSuccess) {
      console.log('Canal ID:', lastSuccess.channelId);
      console.log('Processado em:', lastSuccess.updatedAt);
    } else {
      console.log('Nenhum sucesso ainda');
    }
    console.log('');

    // Pendentes
    const pending = await prisma.channelEntry.count({
      where: { runId: run.id, status: 'PENDING' },
    });

    console.log('=== PENDENTES ===');
    console.log('Canais pendentes:', pending);

    // Verificar erros de quota
    const quotaErrors = await prisma.channelEntry.findMany({
      where: {
        runId: run.id,
        status: 'ERROR',
        OR: [
          { errorMessage: { contains: 'quota' } },
          { errorMessage: { contains: '429' } },
          { errorMessage: { contains: 'exceeded' } },
          { errorMessage: { contains: 'limit' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    if (quotaErrors.length > 0) {
      console.log('');
      console.log('=== ERROS DE QUOTA ===');
      quotaErrors.forEach((e) => {
        console.log(`- ${e.channelId}: ${e.errorMessage?.substring(0, 150)}`);
      });
    }

    console.log('');
    console.log('=== RESUMO ===');
    console.log(`Quota usada: ~${run.success * 50} unidades (${run.success} inscrições × 50)`);
    console.log(`Quota restante: ~${10000 - run.success * 50} unidades`);
    if (run.success >= 200) {
      console.log('⚠️  QUOTA DIARIA EXCEDIDA! Limite de 10.000 unidades/dia atingido.');
      console.log('   Aguarde até meia-noite (PST) para a cota resetar, ou solicite aumento.');
    }
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
