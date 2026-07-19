export interface SaveOptions {
  readonly transactionalEntityManager?: unknown;
  readonly commandId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
}
