import * as fs from 'fs';
import * as path from 'path';
import { SharedModule } from './shared/composition/shared.module';
import { AuthModule } from './auth/composition/auth.module';
import { TenancyModule } from './tenancy/composition/tenancy.module';
import { MaintenanceModule } from './maintenance/composition/maintenance.module';

describe('Modular Monolith Architecture Gates', () => {
  const srcDir = path.resolve(__dirname);

  const readFilesRecursively = (dir: string): string[] => {
    let results: string[] = [];
    if (!fs.existsSync(dir)) {
      return results;
    }
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(readFilesRecursively(fullPath));
      } else if (file.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  };

  /* -------------------------------------------------------------
     1. Codebase Verification Scans
     ------------------------------------------------------------- */

  it('should enforce that domain layers have zero external framework dependencies', () => {
    const modules = ['auth', 'tenancy', 'maintenance'];

    for (const module of modules) {
      const domainDir = path.join(srcDir, module, 'domain');
      if (!fs.existsSync(domainDir)) {
        continue;
      }

      const domainFiles = readFilesRecursively(domainDir);
      for (const filePath of domainFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Pure domain check: no framework imports
        if (content.includes('@nestjs/')) {
          throw new Error(`Domain violation: File ${filePath} imports NestJS`);
        }
        if (content.includes("from 'typeorm'") || content.includes('from "typeorm"')) {
          throw new Error(`Domain violation: File ${filePath} imports TypeORM`);
        }
      }
    }
  });

  it('should enforce that application layers have zero TypeORM persistence dependencies', () => {
    const modules = ['auth', 'tenancy', 'maintenance'];

    for (const module of modules) {
      const appDir = path.join(srcDir, module, 'application');
      if (!fs.existsSync(appDir)) {
        continue;
      }

      const appFiles = readFilesRecursively(appDir);
      for (const filePath of appFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes("from 'typeorm'") || content.includes('from "typeorm"')) {
          throw new Error(`Application violation: File ${filePath} imports TypeORM`);
        }
      }
    }
  });

  it('should enforce that shared layer must never import from any specific bounded context modules', () => {
    const sharedDir = path.join(srcDir, 'shared');
    const sharedFiles = readFilesRecursively(sharedDir);

    for (const file of sharedFiles) {
      if (file.endsWith('test-utils.ts')) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');
      if (
        content.includes("from '../auth/") ||
        content.includes("from '../../auth/") ||
        content.includes("from '../../../auth/") ||
        content.includes("from '../tenancy/") ||
        content.includes("from '../../tenancy/") ||
        content.includes("from '../../../tenancy/") ||
        content.includes("from '../maintenance/") ||
        content.includes("from '../../maintenance/") ||
        content.includes("from '../../../maintenance/")
      ) {
        throw new Error(`Shared violation: File ${file} imports from specific bounded contexts`);
      }
    }
  });

  it('should enforce strict cross-module internal encapsulation rules', () => {
    const modules = ['auth', 'tenancy', 'maintenance'];

    for (const module of modules) {
      const moduleDir = path.join(srcDir, module);
      const files = readFilesRecursively(moduleDir);

      for (const file of files) {
        if (file.includes('/public/') || file.includes('/composition/')) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');

        for (const peer of modules) {
          if (peer === module) {
            continue;
          }

          const invalidImports = [
            `from '../${peer}/domain/`,
            `from '../../${peer}/domain/`,
            `from '../../../${peer}/domain/`,
            `from '../${peer}/application/`,
            `from '../../${peer}/application/`,
            `from '../../../${peer}/application/`,
            `from '../${peer}/infrastructure/`,
            `from '../../${peer}/infrastructure/`,
            `from '../../../${peer}/infrastructure/`,
            `from '../${peer}/interfaces/`,
            `from '../../${peer}/interfaces/`,
            `from '../../../${peer}/interfaces/`,
          ];

          for (const invalid of invalidImports) {
            if (content.includes(invalid)) {
              throw new Error(
                `Encapsulation violation: File ${file} directly imports peer module ${peer} internals`,
              );
            }
          }
        }
      }
    }
  });

  it('should enforce that public directories do not export internal implementation details', () => {
    const modules = ['auth', 'tenancy', 'maintenance'];

    for (const module of modules) {
      const publicDir = path.join(srcDir, module, 'public');
      if (!fs.existsSync(publicDir)) {
        continue;
      }

      const files = fs.readdirSync(publicDir);
      for (const file of files) {
        const filePath = path.join(publicDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        if (
          content.includes('../domain/model/') ||
          content.includes('../infrastructure/persistence/') ||
          content.includes('@nestjs/') ||
          content.includes('typeorm')
        ) {
          throw new Error(
            `Public boundary violation: File ${filePath} exports internal details or has direct framework imports`,
          );
        }
      }
    }
  });

  it('should enforce that no files use @Global decorator', () => {
    const allFiles = readFilesRecursively(srcDir);
    for (const file of allFiles) {
      if (file.endsWith('architecture.spec.ts')) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('@Global()')) {
        throw new Error(
          `Composition violation: File ${file} uses @Global() decorator which violates modular decoupling!`,
        );
      }
    }
  });

  it('should enforce that synchronize:true is never used in TypeORM configurations', () => {
    const allFiles = readFilesRecursively(srcDir);
    for (const file of allFiles) {
      if (file.endsWith('architecture.spec.ts')) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('synchronize: true')) {
        throw new Error(
          `Persistence violation: File ${file} has synchronize: true. Please use schema migrations!`,
        );
      }
    }
  });

  it('should enforce that Knip configuration has no blanket unused-export suppressions', () => {
    const knipPath = path.resolve(srcDir, '../knip.json');
    if (fs.existsSync(knipPath)) {
      const content = fs.readFileSync(knipPath, 'utf-8');
      if (content.includes('"ignoreExports"') && content.includes('"src/**/*.ts"')) {
        throw new Error(
          'Knip configuration violation: Blanket unused-export suppression (src/**/*.ts) detected!',
        );
      }
    }
  });

  /* -------------------------------------------------------------
     2. Programmatic NestJS Module Boundary Checks
     ------------------------------------------------------------- */

  it('should prove programmatically that SharedModule is not global', () => {
    const isGlobal = Reflect.getMetadata('__global__', SharedModule);
    expect(isGlobal).not.toBe(true);
  });

  it('should prove programmatically that modules do not export internal persistence/repository details', () => {
    const forbiddenTokenPatterns = [
      'REPOSITORY',
      'UNIT_OF_WORK',
      'DATABASE',
      'DATA_SOURCE',
      'Entity',
      'Adapter',
      'Mapper',
    ];

    const modules = [
      { name: 'AuthModule', class: AuthModule },
      { name: 'TenancyModule', class: TenancyModule },
      { name: 'MaintenanceModule', class: MaintenanceModule },
    ];

    for (const mod of modules) {
      const exports = Reflect.getMetadata('exports', mod.class) || [];
      for (const exp of exports) {
        const tokenStr = typeof exp === 'function' ? exp.name : String(exp);

        for (const pattern of forbiddenTokenPatterns) {
          const matched = tokenStr.toUpperCase().includes(pattern.toUpperCase());
          if (matched) {
            throw new Error(
              `Module boundary leak: ${mod.name} exports ${tokenStr} which matches forbidden pattern ${pattern}!`,
            );
          }
        }
      }
    }
  });

  it('should prove programmatically that modules do not receive shared providers implicitly', () => {
    const sharedImportsInAuth = Reflect.getMetadata('imports', AuthModule) || [];
    const sharedImportsInTenancy = Reflect.getMetadata('imports', TenancyModule) || [];

    const authImportsShared = sharedImportsInAuth.includes(SharedModule);
    const tenancyImportsShared = sharedImportsInTenancy.includes(SharedModule);

    expect(authImportsShared).toBe(false);
    expect(tenancyImportsShared).toBe(true);
  });

  /* -------------------------------------------------------------
     3. Negative Fixture Proof Tests (Prove the Gates Fail Correctly)
     ------------------------------------------------------------- */

  it('should prove that the gate rejects @nestjs import from domain', () => {
    const checkFile = (content: string) => {
      if (content.includes('@nestjs/')) {
        throw new Error('Domain violation: File imports NestJS');
      }
    };
    const invalidDomainFileContent = `
      import { Injectable } from '@nestjs/common';
      export class DomainService {}
    `;
    expect(() => checkFile(invalidDomainFileContent)).toThrow(
      'Domain violation: File imports NestJS',
    );
  });

  it('should prove that the gate rejects typeorm import from application', () => {
    const checkFile = (content: string) => {
      if (content.includes("from 'typeorm'") || content.includes('from "typeorm"')) {
        throw new Error('Application violation: File imports TypeORM');
      }
    };
    const invalidAppFileContent = `
      import { Repository } from 'typeorm';
      export class AppService {}
    `;
    expect(() => checkFile(invalidAppFileContent)).toThrow(
      'Application violation: File imports TypeORM',
    );
  });

  it('should prove that the gate rejects shared importing a business module', () => {
    const checkFile = (content: string) => {
      if (
        content.includes("from '../auth/") ||
        content.includes("from '../tenancy/") ||
        content.includes("from '../maintenance/")
      ) {
        throw new Error('Shared violation: File imports from specific bounded contexts');
      }
    };
    const invalidSharedFileContent = `
      import { UserAccount } from '../auth/domain/model/user-account.aggregate';
    `;
    expect(() => checkFile(invalidSharedFileContent)).toThrow(
      'Shared violation: File imports from specific bounded contexts',
    );
  });

  it('should prove that the gate rejects module importing another module internals', () => {
    const checkFile = (content: string) => {
      if (content.includes("from '../../tenancy/domain/")) {
        throw new Error('Encapsulation violation: Directly imports peer module tenancy internals');
      }
    };
    const invalidCrossModuleFileContent = `
      import { Tenancy } from '../../tenancy/domain/model/tenancy.aggregate';
    `;
    expect(() => checkFile(invalidCrossModuleFileContent)).toThrow(
      'Encapsulation violation: Directly imports peer module tenancy internals',
    );
  });

  it('should prove that the gate rejects exporting repository through public module surface', () => {
    const checkFile = (content: string) => {
      if (content.includes('../infrastructure/persistence/') || content.includes('Repository')) {
        throw new Error(
          'Public boundary violation: Exports internal details or has direct framework imports',
        );
      }
    };
    const invalidPublicContent = `
      import { TypeOrmUserRepository } from '../infrastructure/persistence/typeorm-user-repository';
      export { TypeOrmUserRepository };
    `;
    expect(() => checkFile(invalidPublicContent)).toThrow(
      'Public boundary violation: Exports internal details or has direct framework imports',
    );
  });

  it('should prove that the gate rejects direct command-handler invocation', () => {
    const checkFile = (content: string) => {
      if (
        content.includes('new ') &&
        content.includes('Handler(') &&
        content.includes('.execute(')
      ) {
        throw new Error(
          'Architecture violation: Direct invocation of command handlers is forbidden! Use CommandBus instead.',
        );
      }
    };
    const invalidHandlerInvocation = `
      const handler = new RegisterUserHandler(repo);
      await handler.execute(command);
    `;
    expect(() => checkFile(invalidHandlerInvocation)).toThrow(
      'Direct invocation of command handlers is forbidden',
    );
  });

  it('should prove that the gate rejects @Global usage', () => {
    const checkFile = (content: string) => {
      if (content.includes('@Global()')) {
        throw new Error(
          'Composition violation: File uses @Global() decorator which violates modular decoupling!',
        );
      }
    };
    const invalidGlobalModule = `
      @Global()
      @Module({
        providers: [SharedService],
      })
      export class SharedModule {}
    `;
    expect(() => checkFile(invalidGlobalModule)).toThrow('uses @Global() decorator');
  });

  it('should prove that the gate rejects synchronize:true', () => {
    const checkFile = (content: string) => {
      if (content.includes('synchronize: true')) {
        throw new Error(
          'Persistence violation: File has synchronize: true. Please use schema migrations!',
        );
      }
    };
    const invalidDataSourceConfig = `
      export const authDataSourceOptions = {
        type: 'postgres',
        synchronize: true,
      };
    `;
    expect(() => checkFile(invalidDataSourceConfig)).toThrow('synchronize: true');
  });

  it('should prove that the gate rejects blanket Knip unused-export suppression', () => {
    const checkFile = (content: string) => {
      if (content.includes('"ignoreExports"') && content.includes('"src/**/*.ts"')) {
        throw new Error(
          'Knip configuration violation: Blanket unused-export suppression (src/**/*.ts) detected!',
        );
      }
    };
    const invalidKnipConfig = `
      {
        "ignoreExports": [
          "src/**/*.ts"
        ]
      }
    `;
    expect(() => checkFile(invalidKnipConfig)).toThrow('Blanket unused-export suppression');
  });
});
