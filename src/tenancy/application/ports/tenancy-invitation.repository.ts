import { TenancyInvitation } from '../../domain/model/tenancy-invitation.aggregate';

export interface TenancyInvitationRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<TenancyInvitation | null>;
  save(invitation: TenancyInvitation, transactionalEntityManager?: unknown): Promise<void>;
}
export const TENANCY_INVITATION_REPOSITORY_TOKEN = 'TenancyInvitationRepository';
