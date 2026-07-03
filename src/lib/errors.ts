const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public error?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function nestErrorResponse(statusCode: number, message: string | string[]) {
  const msg = Array.isArray(message) ? message.join(', ') : message;
  return {
    statusCode,
    message: msg,
    error: STATUS_NAMES[statusCode] || 'Error',
  };
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return nestErrorResponse(error.statusCode, error.message);
  }

  if (error instanceof Error) {
    if (error.message === 'Session not found or does not belong to user') {
      return nestErrorResponse(404, error.message);
    }
    return nestErrorResponse(500, error.message);
  }

  return nestErrorResponse(500, 'Internal server error');
}
