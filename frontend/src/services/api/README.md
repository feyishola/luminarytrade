# API Client Documentation

This document provides comprehensive guidance on using the centralized API client layer in your frontend application.

## Overview

The API client provides a centralized, feature-rich HTTP client with:

- **Singleton Pattern**: Single instance across the application
- **Request/Response Interceptors**: Automatic auth headers, logging, and transformation
- **Error Handling**: Structured error types with retry logic
- **Request Deduplication**: Prevents duplicate concurrent requests
- **Retry Logic**: Exponential backoff for failed requests
- **Request Cancellation**: AbortController support
- **Comprehensive Logging**: Request/response tracking with unique IDs

## Basic Usage

### Import the API Client

```typescript
import { apiClient } from '../services/api';

// Or import specific components
import { ApiClient, ApiError } from '../services/api';
```

### Making HTTP Requests

```typescript
// GET request
const response = await apiClient.get<UserProfile>('/users/123');
console.log(response.data); // UserProfile data
console.log(response.status); // 200
console.log(response.success); // true

// POST request
const newUser = await apiClient.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
const updatedUser = await apiClient.put<User>('/users/123', {
  name: 'Jane Doe'
});

// DELETE request
await apiClient.delete('/users/123');
```

## Advanced Usage

### Custom Configuration

```typescript
// Set default configuration for all requests
apiClient.setDefaultConfig({
  timeout: 15000,
  retries: 5,
  deduplication: false
});

// Per-request configuration
const response = await apiClient.get('/data', {
  timeout: 5000,
  retries: 2,
  deduplication: true
});
```

### Request/Response Transformation

```typescript
// Transform request data
const response = await apiClient.post('/api/data', rawData, {
  transformRequest: (data) => {
    // Convert camelCase to snake_case
    return convertToSnakeCase(data);
  }
});

// Transform response data
const response = await apiClient.get('/api/data', {
  transformResponse: (data) => {
    // Convert snake_case to camelCase
    return convertToCamelCase(data);
  }
});
```

### Request Cancellation

```typescript
// Create timeout controller
const controller = apiClient.createTimeoutController(5000);

// Use with request
try {
  const response = await apiClient.get('/slow-endpoint', {
    signal: controller.signal
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

## Authentication

### Setting Auth Token

```typescript
// Set authentication token
apiClient.setAuthToken('your-jwt-token-here');

// Remove authentication token
apiClient.removeAuthToken();
```

The client automatically includes the `Authorization: Bearer <token>` header for all requests when a token is set.

## Error Handling

### Basic Error Handling

```typescript
import { ApiError, ErrorCode } from '../services/api';

try {
  const response = await apiClient.get('/users/123');
  console.log(response.data);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.status);
    console.error('Code:', error.code);
    console.error('Request ID:', error.requestId);
    
    // Handle specific error types
    if (error.isAuthError()) {
      // Redirect to login
      redirectToLogin();
    } else if (error.isNetworkError()) {
      // Show offline message
      showOfflineMessage();
    } else if (error.isServerError()) {
      // Show server error message
      showServerError(error.message);
    }
  }
}
```

### Error Type Detection

```typescript
// Check specific error types
if (error.isNetworkError()) {
  // Handle network issues
}

if (error.isAuthError()) {
  // Handle authentication issues
}

if (error.isServerError()) {
  // Handle server errors (5xx)
}

if (error.isClientError()) {
  // Handle client errors (4xx)
}

// Check if error should be retried
if (error.shouldRetry()) {
  // Implement retry logic
}
```

### Error Codes

```typescript
enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

## Request Deduplication

The API client automatically prevents duplicate concurrent requests:

```typescript
// These two requests made simultaneously will be deduplicated
const promise1 = apiClient.get('/users/123');
const promise2 = apiClient.get('/users/123');

// Both promises will resolve with the same response
const [response1, response2] = await Promise.all([promise1, promise2]);
```

Disable deduplication if needed:

```typescript
const response = await apiClient.get('/users/123', {
  deduplication: false
});
```

## Retry Logic

Automatic retry with exponential backoff:

```typescript
// Configure retry behavior
apiClient.setDefaultConfig({
  retries: 3
});

// Custom retry configuration
const response = await apiClient.get('/unstable-endpoint', {
  retries: 5
});
```

Only network errors, server errors, and timeout errors are retried by default.

## Logging

### Configure Logging Level

```typescript
apiClient.setLogLevel('debug'); // 'debug' | 'info' | 'warn' | 'error'
```

### Access Logs

```typescript
// Get all logs
const logs = apiClient.getLogs();

// Get logs for specific request ID
const requestLogs = apiClient.getLogsByRequestId('request-id-here');

// Clear logs
apiClient.clearLogs();
```

### Log Format

```typescript
interface IRequestLog {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: string;
  requestId: string;
}

interface IResponseLog {
  url: string;
  method: string;
  status: number;
  statusText: string;
  duration: number;
  timestamp: string;
  requestId: string;
}
```

## Type Safety

### Response Types

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Typed response
const response = await apiClient.get<User>('/users/123');
// response.data is typed as User
console.log(response.data.name); // string
```

### API Response Interface

```typescript
interface IApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  success: boolean;
  timestamp: string;
}
```

## Best Practices

### 1. Use Typed Responses

Always specify the expected response type:

```typescript
// Good
const user = await apiClient.get<User>('/users/123');

// Avoid
const user = await apiClient.get('/users/123');
```

### 2. Handle Errors Appropriately

```typescript
try {
  const response = await apiClient.get<User>('/users/123');
  return response.data;
} catch (error) {
  if (error instanceof ApiError) {
    // Log error details
    console.error('API Error:', error.toJSON());
    
    // Handle based on error type
    if (error.isAuthError()) {
      throw new Error('Authentication required');
    } else if (error.isNetworkError()) {
      throw new Error('Network connection failed');
    }
  }
  throw error;
}
```

### 3. Use Request Deduplication

Enable deduplication for GET requests to prevent unnecessary API calls:

```typescript
const response = await apiClient.get('/users/123', {
  deduplication: true
});
```

### 4. Set Appropriate Timeouts

Configure timeouts based on expected response times:

```typescript
// Quick endpoints
const quickResponse = await apiClient.get('/health', {
  timeout: 2000
});

// Slow endpoints
const slowResponse = await apiClient.get('/reports', {
  timeout: 30000
});
```

### 5. Implement Retry Logic

Configure retries for unreliable endpoints:

```typescript
const response = await apiClient.get('/external-api', {
  retries: 5,
  timeout: 10000
});
```

## Migration from Direct Axios

### Before

```typescript
import axios from 'axios';

const fetchUser = async (id: string) => {
  try {
    const response = await axios.get(`/api/users/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### After

```typescript
import { apiClient, ApiError } from '../services/api';

const fetchUser = async (id: string) => {
  try {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('API Error:', error.toJSON());
      if (error.isAuthError()) {
        // Handle auth error
      }
    }
    throw error;
  }
};
```

## Testing

The API client includes comprehensive tests. Run them with:

```bash
npm test -- --testPathPattern="ApiClient"
npm test -- --testPathPattern="ApiError"
```

## Environment Variables

Configure the API client with environment variables:

```bash
# .env file
REACT_APP_API_BASE_URL=https://api.example.com
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Ensure you have the latest type definitions installed
2. **Missing Auth Headers**: Check that `setAuthToken()` is called before making requests
3. **Request Timeouts**: Increase timeout values for slow endpoints
4. **Retry Issues**: Verify that errors should be retried using `error.shouldRetry()`

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
apiClient.setLogLevel('debug');
```

This will show detailed request/response information in the console.
