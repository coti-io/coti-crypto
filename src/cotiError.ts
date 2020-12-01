export interface CotiErrorOptions {
  cause?: Error;
  debugMessage?: string;
}
export class CotiError extends Error {
  cause?: Error;
  debugMessage?: string;

  constructor(message: string, options?: CotiErrorOptions) {
    super(message);
    const { cause, debugMessage } = options || {};
    this.cause = cause;
    this.debugMessage = debugMessage;
  }

  public setCause(cause: Error) {
    this.cause = cause;
  }
}

export class NodeError extends CotiError {
  constructor(message: string, options?: CotiErrorOptions) {
    super(message, options);
  }
}
