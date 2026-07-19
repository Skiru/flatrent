import * as fs from 'fs';
import * as path from 'path';

describe('Modular Monolith Architecture Gates', () => {
  const srcDir = path.resolve(__dirname);

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

      const readFilesRecursively = (dir: string): string[] => {
        let results: string[] = [];
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
});
