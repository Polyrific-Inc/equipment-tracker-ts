/**
 * Unit tests for async handler utilities
 */

import type { Request, Response, NextFunction } from 'express';
import { asyncHandler, asyncRoute } from '../../../src/infrastructure/utils/async-handler.js';

describe('Async Handler', () => {
  // Mock Express objects
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {},
      query: {},
      params: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('asyncHandler', () => {
    describe('Success cases', () => {
      it('should execute async handler successfully', async () => {
        const mockHandler = jest.fn().mockResolvedValue(undefined);
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        // Wait for Promise to resolve
        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should pass through all parameters correctly', async () => {
        const mockHandler = jest.fn().mockResolvedValue(undefined);
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      });

      it('should handle handler that returns resolved Promise', async () => {
        const mockHandler = jest.fn().mockReturnValue(Promise.resolve());
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle synchronous handler that returns void', async () => {
        const mockHandler = jest.fn().mockReturnValue(undefined);
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow handler to call next() for passing control', async () => {
        const mockHandler = jest.fn().mockImplementation(async (req, res, next) => {
          next();
        });
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('should allow handler to call next() with data', async () => {
        const testData = { message: 'test' };
        const mockHandler = jest.fn().mockImplementation(async (req, res, next) => {
          next(testData);
        });
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(testData);
      });
    });

    describe('Error cases', () => {
      it('should catch and forward thrown errors', async () => {
        const testError = new Error('Test error');
        const mockHandler = jest.fn().mockRejectedValue(testError);
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(testError);
      });

      it('should catch synchronous errors thrown in async handler', async () => {
        const testError = new Error('Synchronous error');
        const mockHandler = jest.fn().mockImplementation(async () => {
          throw testError;
        });
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(testError);
      });

      it('should handle Promise rejection', async () => {
        const testError = new Error('Promise rejection');
        const mockHandler = jest.fn().mockReturnValue(Promise.reject(testError));
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(testError);
      });

      it('should handle non-Error objects thrown', async () => {
        const testError = 'String error';
        const mockHandler = jest.fn().mockRejectedValue(testError);
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(testError);
      });

      it('should handle handler that throws after calling next()', async () => {
        const testError = new Error('Error after next');
        const mockHandler = jest.fn().mockImplementation(async (req, res, next) => {
          next();
          throw testError;
        });
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledTimes(2);
        expect(mockNext).toHaveBeenNthCalledWith(1); // First call with no args
        expect(mockNext).toHaveBeenNthCalledWith(2, testError); // Second call with error
      });

      it('should handle undefined/null errors', async () => {
        const mockHandler = jest.fn().mockRejectedValue(null);
        const wrappedHandler = asyncHandler(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(null);
      });
    });

    describe('Multiple calls', () => {
      it('should handle multiple concurrent calls independently', async () => {
        const mockHandler1 = jest.fn().mockResolvedValue(undefined);
        const mockHandler2 = jest.fn().mockRejectedValue(new Error('Handler 2 error'));
        
        const wrappedHandler1 = asyncHandler(mockHandler1);
        const wrappedHandler2 = asyncHandler(mockHandler2);

        const mockNext1 = jest.fn();
        const mockNext2 = jest.fn();

        wrappedHandler1(mockRequest as Request, mockResponse as Response, mockNext1);
        wrappedHandler2(mockRequest as Request, mockResponse as Response, mockNext2);

        await Promise.resolve();

        expect(mockHandler1).toHaveBeenCalledTimes(1);
        expect(mockHandler2).toHaveBeenCalledTimes(1);
        expect(mockNext1).not.toHaveBeenCalled();
        expect(mockNext2).toHaveBeenCalledWith(expect.any(Error));
      });

      it('should handle sequential calls to same wrapped handler', async () => {
        const mockHandler = jest.fn().mockResolvedValue(undefined);
        const wrappedHandler = asyncHandler(mockHandler);

        const mockNext1 = jest.fn();
        const mockNext2 = jest.fn();

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext1);
        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext2);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledTimes(2);
        expect(mockNext1).not.toHaveBeenCalled();
        expect(mockNext2).not.toHaveBeenCalled();
      });
    });
  });

  describe('asyncRoute', () => {
    describe('Success cases', () => {
      it('should execute async route handler successfully', async () => {
        const mockHandler = jest.fn().mockResolvedValue(undefined);
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should not pass next parameter to handler', async () => {
        const mockHandler = jest.fn().mockResolvedValue(undefined);
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledTimes(1);
        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
        // Handler should only receive req and res, not next
        expect(mockHandler).not.toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      });

      it('should handle handler that returns resolved Promise', async () => {
        const mockHandler = jest.fn().mockReturnValue(Promise.resolve());
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle synchronous handler', async () => {
        const mockHandler = jest.fn().mockReturnValue(undefined);
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow handler to send response', async () => {
        const mockHandler = jest.fn().mockImplementation(async (req, res) => {
          res.json({ message: 'success' });
        });
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'success' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Error cases', () => {
      it('should catch and forward thrown errors', async () => {
        const testError = new Error('Route error');
        const mockHandler = jest.fn().mockRejectedValue(testError);
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
        expect(mockNext).toHaveBeenCalledWith(testError);
      });

      it('should catch synchronous errors', async () => {
        const testError = new Error('Sync route error');
        const mockHandler = jest.fn().mockImplementation(async () => {
          throw testError;
        });
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(testError);
      });

      it('should handle Promise rejection', async () => {
        const testError = new Error('Promise rejection in route');
        const mockHandler = jest.fn().mockReturnValue(Promise.reject(testError));
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(testError);
      });

      it('should handle non-Error objects thrown', async () => {
        const testError = { message: 'Custom error object' };
        const mockHandler = jest.fn().mockRejectedValue(testError);
        const wrappedHandler = asyncRoute(mockHandler);

        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

        await Promise.resolve();

        expect(mockNext).toHaveBeenCalledWith(testError);
      });
    });

    describe('Multiple calls', () => {
      it('should handle multiple concurrent route calls', async () => {
        const mockHandler1 = jest.fn().mockResolvedValue(undefined);
        const mockHandler2 = jest.fn().mockRejectedValue(new Error('Route 2 error'));
        
        const wrappedRoute1 = asyncRoute(mockHandler1);
        const wrappedRoute2 = asyncRoute(mockHandler2);

        const mockNext1 = jest.fn();
        const mockNext2 = jest.fn();

        wrappedRoute1(mockRequest as Request, mockResponse as Response, mockNext1);
        wrappedRoute2(mockRequest as Request, mockResponse as Response, mockNext2);

        await Promise.resolve();

        expect(mockHandler1).toHaveBeenCalledTimes(1);
        expect(mockHandler2).toHaveBeenCalledTimes(1);
        expect(mockNext1).not.toHaveBeenCalled();
        expect(mockNext2).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('TypeScript type checking', () => {
    it('should accept custom Request and Response types', async () => {
      interface CustomRequest extends Request {
        customField?: string;
      }

      interface CustomResponse extends Response {
        customMethod?: () => void;
      }

      const mockCustomHandler = jest.fn().mockResolvedValue(undefined);
      
      // These should compile without TypeScript errors
      const wrappedHandler = asyncHandler<CustomRequest, CustomResponse>(mockCustomHandler);
      const wrappedRoute = asyncRoute<CustomRequest, CustomResponse>(mockCustomHandler);

      const customReq = { ...mockRequest, customField: 'test' } as CustomRequest;
      const customRes = { ...mockResponse, customMethod: jest.fn() } as CustomResponse;

      wrappedHandler(customReq, customRes, mockNext);
      wrappedRoute(customReq, customRes, mockNext);

      await Promise.resolve();

      expect(mockCustomHandler).toHaveBeenCalledTimes(2);
    });

    it('should maintain function signature compatibility', () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const wrappedHandler = asyncHandler(mockHandler);
      const wrappedRoute = asyncRoute(mockHandler);

      // These should be compatible with Express middleware signature
      expect(typeof wrappedHandler).toBe('function');
      expect(typeof wrappedRoute).toBe('function');
      expect(wrappedHandler.length).toBe(3); // req, res, next
      expect(wrappedRoute.length).toBe(3); // req, res, next (even though handler only uses 2)
    });
  });

  describe('Integration with Express-like middleware', () => {
    it('should work as Express middleware', async () => {
      const mockHandler = jest.fn().mockImplementation(async (req, res) => {
        res.status(200).json({ message: 'success' });
      });
      
      const middleware = asyncHandler(mockHandler);

      // Simulate Express calling the middleware
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      await Promise.resolve();

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'success' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should integrate with error handling middleware', async () => {
      const testError = new Error('Middleware error');
      const mockHandler = jest.fn().mockRejectedValue(testError);
      const middleware = asyncHandler(mockHandler);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      await Promise.resolve();

      // Error should be passed to next() for error handling middleware
      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should work in middleware chain', async () => {
      const middleware1 = asyncHandler(jest.fn().mockImplementation(async (req, res, next) => {
        req.body.processed = true;
        next();
      }));

      const middleware2 = asyncHandler(jest.fn().mockImplementation(async (req, res) => {
        res.json({ processed: req.body.processed });
      }));

      // First middleware
      middleware1(mockRequest as Request, mockResponse as Response, mockNext);
      await Promise.resolve();

      expect(mockRequest.body.processed).toBe(true);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second middleware (reset mock)
      mockNext.mockClear();
      middleware2(mockRequest as Request, mockResponse as Response, mockNext);
      await Promise.resolve();

      expect(mockResponse.json).toHaveBeenCalledWith({ processed: true });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases and performance', () => {
    it('should handle handler that takes very long time', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
      });
      const wrappedHandler = asyncHandler(mockHandler);

      const start = Date.now();
      wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

      // Should not block synchronously (allow more time for slower environments)
      const syncTime = Date.now() - start;
      expect(syncTime).toBeLessThan(50); // Increased tolerance

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 15));

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle rapid successive calls', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const wrappedHandler = asyncHandler(mockHandler);

      // Make 100 rapid calls
      const calls = Array.from({ length: 100 }, (_, i) => {
        const mockNextLocal = jest.fn();
        wrappedHandler(mockRequest as Request, mockResponse as Response, mockNextLocal);
        return mockNextLocal;
      });

      await Promise.resolve();

      expect(mockHandler).toHaveBeenCalledTimes(100);
      calls.forEach(nextFn => {
        expect(nextFn).not.toHaveBeenCalled();
      });
    });

    it('should handle mixed success and error calls', async () => {
      const successHandler = asyncHandler(jest.fn().mockResolvedValue(undefined));
      const errorHandler = asyncHandler(jest.fn().mockRejectedValue(new Error('Test')));

      const successNext = jest.fn();
      const errorNext = jest.fn();

      // Interleave success and error calls
      successHandler(mockRequest as Request, mockResponse as Response, successNext);
      errorHandler(mockRequest as Request, mockResponse as Response, errorNext);
      successHandler(mockRequest as Request, mockResponse as Response, successNext);
      errorHandler(mockRequest as Request, mockResponse as Response, errorNext);

      await Promise.resolve();

      expect(successNext).not.toHaveBeenCalled();
      expect(errorNext).toHaveBeenCalledTimes(2);
      expect(errorNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should maintain correct this context', async () => {
      const contextObject = {
        value: 'test',
        async handler(req: Request, res: Response) {
          expect(this.value).toBe('test');
          res.json({ value: this.value });
        }
      };

      const wrappedHandler = asyncHandler(contextObject.handler.bind(contextObject));
      wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

      await Promise.resolve();

      expect(mockResponse.json).toHaveBeenCalledWith({ value: 'test' });
    });

    it('should handle memory-intensive operations gracefully', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        // Simulate memory-intensive operation
        const largeArray = new Array(1000).fill('test');
        expect(largeArray.length).toBe(1000);
      });

      const wrappedHandler = asyncHandler(mockHandler);

      // Should not cause memory issues
      for (let i = 0; i < 10; i++) {
        const localNext = jest.fn();
        wrappedHandler(mockRequest as Request, mockResponse as Response, localNext);
      }

      await Promise.resolve();

      expect(mockHandler).toHaveBeenCalledTimes(10);
    });
  });

  describe('Comparison between asyncHandler and asyncRoute', () => {
    it('should demonstrate difference in parameter passing', async () => {
      const handlerSpy = jest.fn().mockResolvedValue(undefined);
      const routeSpy = jest.fn().mockResolvedValue(undefined);

      const wrappedHandler = asyncHandler(handlerSpy);
      const wrappedRoute = asyncRoute(routeSpy);

      wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);
      wrappedRoute(mockRequest as Request, mockResponse as Response, mockNext);

      await Promise.resolve();

      // asyncHandler passes all 3 parameters
      expect(handlerSpy).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      
      // asyncRoute only passes req and res
      expect(routeSpy).toHaveBeenCalledWith(mockRequest, mockResponse);
      expect(routeSpy).not.toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    });

    it('should handle errors identically', async () => {
      const testError = new Error('Comparison test');
      const handlerSpy = jest.fn().mockRejectedValue(testError);
      const routeSpy = jest.fn().mockRejectedValue(testError);

      const wrappedHandler = asyncHandler(handlerSpy);
      const wrappedRoute = asyncRoute(routeSpy);

      const handlerNext = jest.fn();
      const routeNext = jest.fn();

      wrappedHandler(mockRequest as Request, mockResponse as Response, handlerNext);
      wrappedRoute(mockRequest as Request, mockResponse as Response, routeNext);

      await Promise.resolve();

      // Both should call next with the error
      expect(handlerNext).toHaveBeenCalledWith(testError);
      expect(routeNext).toHaveBeenCalledWith(testError);
    });
  });
});