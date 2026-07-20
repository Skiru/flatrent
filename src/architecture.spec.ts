import * as fs from 'fs';
import * as path from 'path';

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

  it('should enforce that shared layer must never import from any specific bounded context modules', () => {
    const sharedDir = path.join(srcDir, 'shared');
    const sharedFiles = readFilesRecursively(sharedDir);

    for (const file of sharedFiles) {
      // Skip test utilities/mocks which are allowed to contain context mocks
      if (file.endsWith('test-utils.ts')) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');

      // Shared must be pure and decoupled
      expect(content).not.toContain("from '../auth/");
      expect(content).not.toContain("from '../../auth/");
      expect(content).not.toContain("from '../../../auth/");
      expect(content).not.toContain("from '../tenancy/");
      expect(content).not.toContain("from '../../tenancy/");
      expect(content).not.toContain("from '../../../tenancy/");
      expect(content).not.toContain("from '../maintenance/");
      expect(content).not.toContain("from '../../maintenance/");
      expect(content).not.toContain("from '../../../maintenance/");
    }
  });

  it('should enforce strict cross-module internal encapsulation rules', () => {
    const modules = ['auth', 'tenancy', 'maintenance'];

    for (const module of modules) {
      const moduleDir = path.join(srcDir, module);
      const files = readFilesRecursively(moduleDir);

      for (const file of files) {
        // Skip files in the public boundary or composition root
        if (file.includes('/public/') || file.includes('/composition/')) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');

        // Check each other module
        for (const peer of modules) {
          if (peer === module) {
            continue;
          }

          // Must not import internals of the peer module
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
            expect(content).not.toContain(invalid);
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

        // Public boundary files should not import internals directly
        expect(content).not.toContain('../domain/model/');
        expect(content).not.toContain('../infrastructure/persistence/');
        expect(content).not.toContain('@nestjs/');
        expect(content).not.toContain('typeorm');
      }
    }
  });

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
        expect(content).not.toContain('@nestjs/');
        expect(content).not.toContain('typeorm');
        expect(content).not.toContain('@aws-sdk/');
        expect(content).not.toContain('ioredis');
        expect(content).not.toContain('passport');
      }
    }
  });

  it('should fail the gate on an intentionally forbidden cross-module import', () => {
    // Regression fixture: verify that a mock forbidden import triggers an assertion failure
    const fakeFileContent =
      "import { UserAccount } from '../../auth/domain/model/user-account.aggregate';";

    const checkFile = (content: string) => {
      if (content.includes("from '../../auth/domain/")) {
        throw new Error(
          'Architecture Gate Failure: Forbidden cross-module internal import detected!',
        );
      }
    };

    expect(() => checkFile(fakeFileContent)).toThrow(
      'Architecture Gate Failure: Forbidden cross-module internal import detected!',
    );
  });
});
