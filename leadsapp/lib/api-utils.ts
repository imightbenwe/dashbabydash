/**
 * API Utilities - Standardized response handling and error management
 */

import { NextResponse } from 'next/server';
import type { ApiSuccessResponse, ApiErrorResponse } from './types/index';

// ============================================================================
// API RESPONSE BUILDERS
// ============================================================================

/**
 * Create a standardized success response
 */
export function apiSuccess<T>(
  data: T,
  message?: string,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

export function apiError(
  message: string,
  status = 500,
  code = 'INTERNAL_ERROR',
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: message,
    code,
  };
  
  if (details) {
    errorResponse.details = details;
  }

  return NextResponse.json(errorResponse, { status });
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const ErrorCodes = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE: 'DUPLICATE',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  FILE_PROCESSING_ERROR: 'FILE_PROCESSING_ERROR',
} as const;

// ============================================================================
// ERROR HANDLERS
// ============================================================================

/**
 * Handle validation errors
 */
export function validationError(
  field: string,
  message: string
): NextResponse<ApiErrorResponse> {
  return apiError(
    `Validation failed for field '${field}': ${message}`,
    400,
    ErrorCodes.VALIDATION_ERROR,
    { field }
  );
}

/**
 * Handle missing required field
 */
export function missingFieldError(field: string): NextResponse<ApiErrorResponse> {
  return apiError(
    `Required field '${field}' is missing`,
    400,
    ErrorCodes.MISSING_FIELD,
    { field }
  );
}

/**
 * Handle database errors
 */
export function databaseError(
  operation: string,
  error: unknown
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
  
  return apiError(
    `Database ${operation} failed: ${errorMessage}`,
    500,
    ErrorCodes.DATABASE_ERROR,
    { operation, originalError: errorMessage }
  );
}

/**
 * Handle external API errors (Google Places, OpenAI, etc.)
 */
export function externalApiError(
  service: string,
  error: unknown
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : 'External API request failed';
  
  return apiError(
    `${service} API error: ${errorMessage}`,
    502,
    ErrorCodes.EXTERNAL_API_ERROR,
    { service, originalError: errorMessage }
  );
}

/**
 * Handle not found errors
 */
export function notFoundError(resource: string, id?: string): NextResponse<ApiErrorResponse> {
  const message = id 
    ? `${resource} with id '${id}' not found`
    : `${resource} not found`;
    
  return apiError(message, 404, ErrorCodes.NOT_FOUND, { resource, id });
}

// ============================================================================
// REQUEST VALIDATION HELPERS
// ============================================================================

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  requiredFields: string[]
): { valid: true } | { valid: false; error: NextResponse<ApiErrorResponse> } {
  for (const field of requiredFields) {
    if (!body[field]) {
      return { valid: false, error: missingFieldError(field) };
    }
  }
  return { valid: true };
}

/**
 * Validate file upload
 */
export function validateFile(
  file: File | null | undefined,
  options: {
    required?: boolean;
    maxSize?: number; // in bytes
    allowedTypes?: string[];
  } = {}
): { valid: true } | { valid: false; error: NextResponse<ApiErrorResponse> } {
  if (!file) {
    if (options.required) {
      return { valid: false, error: missingFieldError('file') };
    }
    return { valid: true };
  }

  if (options.maxSize && file.size > options.maxSize) {
    return {
      valid: false,
      error: validationError(
        'file',
        `File size ${file.size} exceeds maximum allowed size ${options.maxSize}`
      ),
    };
  }

  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: validationError(
        'file',
        `File type ${file.type} not allowed. Allowed types: ${options.allowedTypes.join(', ')}`
      ),
    };
  }

  return { valid: true };
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T = unknown>(
  text: string,
  fallback?: T
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON';
    if (fallback !== undefined) {
      return { success: true, data: fallback };
    }
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Create paginated response metadata
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
): {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
} {
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  return {
    total,
    page,
    limit,
    totalPages,
    hasMore,
  };
}

// ============================================================================
// REQUEST HELPERS
// ============================================================================

/**
 * Extract user ID from request (placeholder for auth implementation)
 */
export async function getUserFromRequest(request: Request): Promise<string | null> {
  // TODO: Implement proper authentication
  // For now, return a mock user ID or extract from headers
  const userId = request.headers.get('x-user-id');
  return userId;
}

/**
 * Safely read request body as JSON
 */
export async function readJsonBody<T = Record<string, unknown>>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; error: NextResponse<ApiErrorResponse> }> {
  try {
    const body = await request.json();
    return { success: true, data: body as T };
  } catch (error) {
    return {
      success: false,
      error: apiError('Invalid JSON in request body', 400, ErrorCodes.INVALID_FORMAT),
    };
  }
}

// ============================================================================
// RATE LIMITING (Placeholder)
// ============================================================================

/**
 * Check rate limit for a request
 * TODO: Implement with Redis/Upstash when ready
 */
export async function checkRateLimit(_identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
}> {
  // Placeholder - always allow for now
  return {
    allowed: true,
    remaining: 100,
    reset: Date.now() + 60000,
  };
}
