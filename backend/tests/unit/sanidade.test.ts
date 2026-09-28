import { describe, it, expect } from 'vitest';
import { Competencia } from '../../src/domain/entities/Competencia.js';

describe('Configuração do ambiente', () => {
  it('executa testes', () => {
    expect(1 + 1).toBe(2);
  });

  it('importa código do src', () => {
    const c = new Competencia('Iluminação', 8);
    expect(c.getNome()).toBe('Iluminação');
    expect(c.getNivel()).toBe(8);
  });
});
