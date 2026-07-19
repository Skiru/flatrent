export interface UnitOfWork {
  runInTransaction<T>(work: (transactionalEntityManager: unknown) => Promise<T>): Promise<T>;
}
export const UNIT_OF_WORK_TOKEN = 'UnitOfWork';
