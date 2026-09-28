import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Ponto de entrada (sobe o servidor/cluster): exercitado pelo teste de carga e pelo npm run dev.
        'src/server.ts',
        // Precisam de um PostgreSQL real: cobertos por tests/integration/prisma.test.ts (TESTAR_PRISMA=1).
        'src/infrastructure/repositories/prisma/*Prisma.ts',
        'src/infrastructure/repositories/prisma/index.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
