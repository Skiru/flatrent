export interface TenancyAccessPort {
  verifyActiveAccess(userId: string, rentalUnitId: string): Promise<boolean>;
}
export const TENANCY_ACCESS_PORT_TOKEN = 'TenancyAccessPort';
