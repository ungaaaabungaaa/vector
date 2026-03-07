import { describe, it, expect } from 'vitest';
import {
  extractAuthErrorMessage,
  isNetworkError,
  isServerError,
  isAuthError,
} from './auth-error-handler';

describe('Auth Error Handler', () => {
  describe('extractAuthErrorMessage', () => {
    it('should handle InvalidAccountId error', () => {
      const error = 'InvalidAccountId at retrieveAccount';
      expect(extractAuthErrorMessage(error)).toBe('Invalid email or password');
    });

    it('should handle InvalidCredentials error', () => {
      const error = 'InvalidCredentials: Invalid email or password';
      expect(extractAuthErrorMessage(error)).toBe('Invalid email or password');
    });

    it('should handle UserNotFound error', () => {
      const error = 'UserNotFound: No user found with this email';
      expect(extractAuthErrorMessage(error)).toBe(
        'Account not found. Please check your email or sign up',
      );
    });

    it('should handle EmailAlreadyExists error', () => {
      const error =
        'EmailAlreadyExists: An account with this email already exists';
      expect(extractAuthErrorMessage(error)).toBe(
        'An account with this email already exists',
      );
    });

    it('should handle PasswordTooShort error', () => {
      const error = 'PasswordTooShort: Password must be at least 8 characters';
      expect(extractAuthErrorMessage(error)).toBe(
        'Password must be at least 8 characters long',
      );
    });

    it('should handle InvalidEmail error', () => {
      const error = 'InvalidEmail: Please enter a valid email address';
      expect(extractAuthErrorMessage(error)).toBe(
        'Please enter a valid email address',
      );
    });

    it('should handle network errors', () => {
      const error = 'NetworkError: Failed to fetch';
      expect(extractAuthErrorMessage(error)).toBe(
        'Network error. Please check your connection and try again',
      );
    });

    it('should handle server errors', () => {
      const error = 'Server Error: Internal Server Error';
      expect(extractAuthErrorMessage(error)).toBe(
        'Server error. Please try again later',
      );
    });

    it('should handle long stack traces', () => {
      const error =
        'InvalidAccountId at retrieveAccount\nat async authorize\nat async handleCredentials\nat async handler';
      expect(extractAuthErrorMessage(error)).toBe('Invalid email or password');
    });

    it('should handle very long error messages', () => {
      const error = 'A'.repeat(500) + 'InvalidAccountId';
      expect(extractAuthErrorMessage(error)).toBe(
        'Authentication failed. Please try again',
      );
    });

    it('should handle string errors', () => {
      const error = 'InvalidAccountId at retrieveAccount';
      expect(extractAuthErrorMessage(error)).toBe('Invalid email or password');
    });

    it('should handle null/undefined', () => {
      expect(extractAuthErrorMessage(null)).toBe(
        'An unexpected error occurred',
      );
      expect(extractAuthErrorMessage(undefined)).toBe(
        'An unexpected error occurred',
      );
    });

    it('should handle objects with message property', () => {
      const error = { message: 'InvalidAccountId at retrieveAccount' };
      expect(extractAuthErrorMessage(error)).toBe('Invalid email or password');
    });

    it('should handle objects with error property', () => {
      const error = { error: 'InvalidAccountId at retrieveAccount' };
      expect(extractAuthErrorMessage(error)).toBe('Invalid email or password');
    });
  });

  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      expect(isNetworkError(new Error('NetworkError: Failed to fetch'))).toBe(
        true,
      );
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
      expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    });

    it('should not detect non-network errors', () => {
      expect(isNetworkError(new Error('InvalidAccountId'))).toBe(false);
      expect(isNetworkError(new Error('Server Error'))).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should detect server errors', () => {
      expect(isServerError(new Error('Server Error'))).toBe(true);
      expect(isServerError(new Error('Internal Server Error'))).toBe(true);
      expect(isServerError(new Error('500'))).toBe(true);
      expect(isServerError(new Error('Request failed'))).toBe(true);
    });

    it('should not detect non-server errors', () => {
      expect(isServerError(new Error('InvalidAccountId'))).toBe(false);
      expect(isServerError(new Error('NetworkError'))).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should detect auth errors', () => {
      expect(isAuthError(new Error('InvalidAccountId'))).toBe(true);
      expect(isAuthError(new Error('InvalidCredentials'))).toBe(true);
      expect(isAuthError(new Error('UserNotFound'))).toBe(true);
      expect(isAuthError(new Error('Unauthorized'))).toBe(true);
      expect(isAuthError(new Error('401'))).toBe(true);
    });

    it('should not detect non-auth errors', () => {
      expect(isAuthError(new Error('NetworkError'))).toBe(false);
      expect(isAuthError(new Error('Server Error'))).toBe(false);
    });
  });
});
