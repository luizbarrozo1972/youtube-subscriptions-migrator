const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script para atualizar erros existentes com errorType baseado na mensagem de erro
 */
(async () => {
  try {
    console.log('Atualizando erros existentes com errorType...');

    // Atualizar erros de quota
    const quotaResult = await prisma.channelEntry.updateMany({
      where: {
        status: 'ERROR',
        errorMessage: {
          contains: 'quota',
        },
        errorType: null,
      },
      data: {
        errorType: 'QUOTA',
        lastErrorAt: new Date(),
      },
    });
    console.log(`✓ Atualizados ${quotaResult.count} erros de quota`);

    // Atualizar erros de quota por "exceeded"
    const exceededResult = await prisma.channelEntry.updateMany({
      where: {
        status: 'ERROR',
        errorMessage: {
          contains: 'exceeded',
        },
        errorType: null,
      },
      data: {
        errorType: 'QUOTA',
        lastErrorAt: new Date(),
      },
    });
    console.log(`✓ Atualizados ${exceededResult.count} erros por "exceeded"`);

    console.log('\nConcluído!');
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
