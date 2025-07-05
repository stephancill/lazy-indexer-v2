import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

describe('Migrate Command', () => {
  it('should create migrate command structure', async () => {
    const { migrateCommand } = await import('./migrate.js');
    
    expect(migrateCommand).toBeInstanceOf(Command);
    expect(migrateCommand.name()).toBe('migrate');
    expect(migrateCommand.description()).toContain('Database migration commands');
  });

  it('should have required subcommands', async () => {
    const { migrateCommand } = await import('./migrate.js');
    
    const subcommands = migrateCommand.commands;
    const commandNames = subcommands.map(cmd => cmd.name());
    
    expect(commandNames).toContain('up');
    expect(commandNames).toContain('reset');
    expect(commandNames).toContain('status');
  });
});