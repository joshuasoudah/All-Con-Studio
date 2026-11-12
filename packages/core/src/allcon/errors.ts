export class StudioError extends Error {
  readonly key: string;

  constructor(key: string, message = key) {
    super(message);
    this.name = 'StudioError';
    this.key = key;
  }
}
