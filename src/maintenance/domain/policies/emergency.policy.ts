export class MaintenanceEmergencyPolicy {
  private static readonly EMERGENCY_KEYWORDS = [
    'leak',
    'flood',
    'fire',
    'gas',
    'pipe break',
    'no power',
    'explosion',
    'short circuit',
  ];

  public static isEmergency(description: string): boolean {
    if (!description) {
      return false;
    }
    const lower = description.toLowerCase();
    return this.EMERGENCY_KEYWORDS.some((keyword) => lower.includes(keyword));
  }
}
