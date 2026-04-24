export interface ExtensionTestRouteResponse {
  statusCode: number
  message: string
  data: {
    message: string
    code: string
  }
}

/**
 * Creates a stable error-like response shape for extension route unit tests.
 *
 * @param statusCode HTTP status code to include in the response.
 * @param code Machine-readable extension error code.
 * @param message Human-readable test message.
 * @returns A response object matching the host extension route error shape.
 */
export const createExtensionTestRouteResponse = (
  statusCode: number,
  code: string,
  message: string
): ExtensionTestRouteResponse => ({
  statusCode,
  message,
  data: {
    message,
    code
  }
})
