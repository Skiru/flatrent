/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    /* -------------------------------------------------------------
       1. Strict Bounded Context boundaries (Auth, Tenancy, Maintenance)
       ------------------------------------------------------------- */
    {
      name: 'no-cross-module-internal-imports',
      comment: 'Modules must only communicate through their public boundaries, never directly import internals from other modules.',
      severity: 'error',
      from: { path: '^src/([^/]+)/' },
      to: {
        path: '^src/([^/]+)/',
        pathNot: [
          '^src/$1/', // Can import within themselves
          '^src/([^/]+)/public/', // Can import public folders of other modules
          '^src/([^/]+)/composition/' // Composition/wire-up can wire things
        ]
      }
    },

    /* -------------------------------------------------------------
       2. Strict Onion Architecture boundaries (Domain, Application, Interfaces, Infrastructure)
       ------------------------------------------------------------- */
    {
      name: 'domain-cannot-depend-on-anything-outside',
      comment: 'The domain layer must be completely pure. It must not depend on application, interfaces, infrastructure, or third-party frameworks/libraries.',
      severity: 'error',
      from: { path: '^src/([^/]+)/domain/' },
      to: {
        path: '^src/',
        pathNot: '^src/$1/domain/'
      }
    },
    {
      name: 'domain-cannot-depend-on-frameworks',
      comment: 'The domain layer cannot import NestJS, TypeORM, AWS SDK, ioredis, or Passport.',
      severity: 'error',
      from: { path: '^src/([^/]+)/domain/' },
      to: {
        dependencyTypes: ['npm'],
        path: '@nestjs/|typeorm|@aws-sdk/|ioredis|passport|express'
      }
    },
    {
      name: 'application-cannot-depend-on-outer-layers',
      comment: 'The application layer can only depend on the domain layer. It must not depend on interfaces, infrastructure, or composition layers.',
      severity: 'error',
      from: { path: '^src/([^/]+)/application/' },
      to: {
        path: '^src/',
        pathNot: '^src/$1/(domain|application)/'
      }
    },
    {
      name: 'application-cannot-depend-on-frameworks',
      comment: 'The application layer cannot import NestJS, TypeORM, AWS SDK, ioredis, or Passport.',
      severity: 'error',
      from: { path: '^src/([^/]+)/application/' },
      to: {
        dependencyTypes: ['npm'],
        path: '@nestjs/|typeorm|@aws-sdk/|ioredis|passport|express'
      }
    },
    {
      name: 'public-cannot-depend-on-outer-layers',
      comment: 'The public export layer can only depend on domain and application contracts, never on interfaces or infrastructure.',
      severity: 'error',
      from: { path: '^src/([^/]+)/public/' },
      to: {
        path: '^src/',
        pathNot: '^src/$1/(domain|application|public)/'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    reporterOptions: {
      text: {
        highlightFocused: true
      }
    }
  }
};
//
