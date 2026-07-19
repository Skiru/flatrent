export interface ReactionCatalogEntry {
  readonly reactionId: string;
  readonly version: number;
}

export const AUTH_RELIABLE_REACTIONS_CATALOG: Record<string, readonly ReactionCatalogEntry[]> = {
  'RefreshTokenReuseDetectedDomainEvent.v1': [
    { reactionId: 'auth.audit-security-alert', version: 1 },
  ],
  'UserRegisteredDomainEvent.v1': [], // No reliable reactions currently registered
};
