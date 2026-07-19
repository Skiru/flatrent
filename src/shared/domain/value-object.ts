export abstract class ValueObject<T> {
  protected constructor(public readonly value: T) {
    Object.freeze(this);
  }

  public equals(other?: ValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}
