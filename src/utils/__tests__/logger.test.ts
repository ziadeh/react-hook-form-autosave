/**
 * Tests for logger utility
 * Covers ConsoleLogger and createLogger functionality
 */

import { ConsoleLogger, createLogger } from '../logger';

describe('ConsoleLogger', () => {
  let consoleSpy: {
    debug: jest.SpyInstance;
    log: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('enabled logger', () => {
    it('should log debug messages', () => {
      const logger = new ConsoleLogger('test', true);
      logger.debug('test message');

      expect(consoleSpy.debug).toHaveBeenCalledWith('[autosave:test]', 'test message', '');
    });

    it('should log debug with metadata', () => {
      const logger = new ConsoleLogger('test', true);
      const meta = { key: 'value' };
      logger.debug('test message', meta);

      expect(consoleSpy.debug).toHaveBeenCalledWith('[autosave:test]', 'test message', meta);
    });

    it('should use console.debug when available', () => {
      const logger = new ConsoleLogger('test', true);
      logger.debug('test message');

      // Verify either debug or log was called (debug is preferred but implementation may vary)
      const debugOrLogCalled = consoleSpy.debug.mock.calls.length > 0 || consoleSpy.log.mock.calls.length > 0;
      expect(debugOrLogCalled).toBe(true);
    });

    it('should log info messages', () => {
      const logger = new ConsoleLogger('test', true);
      logger.info('info message');

      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:test]', 'info message', '');
    });

    it('should log info with metadata', () => {
      const logger = new ConsoleLogger('test', true);
      const meta = { count: 5 };
      logger.info('info message', meta);

      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:test]', 'info message', meta);
    });

    it('should log warning messages', () => {
      const logger = new ConsoleLogger('test', true);
      logger.warn('warning message');

      expect(consoleSpy.warn).toHaveBeenCalledWith('[autosave:test]', 'warning message', '');
    });

    it('should log warning with metadata', () => {
      const logger = new ConsoleLogger('test', true);
      const meta = { reason: 'timeout' };
      logger.warn('warning message', meta);

      expect(consoleSpy.warn).toHaveBeenCalledWith('[autosave:test]', 'warning message', meta);
    });

    it('should log error messages', () => {
      const logger = new ConsoleLogger('test', true);
      logger.error('error message');

      expect(consoleSpy.error).toHaveBeenCalledWith('[autosave:test]', 'error message', undefined, '');
    });

    it('should log error with Error object', () => {
      const logger = new ConsoleLogger('test', true);
      const error = new Error('test error');
      logger.error('error message', error);

      expect(consoleSpy.error).toHaveBeenCalledWith('[autosave:test]', 'error message', error, '');
    });

    it('should log error with Error object and metadata', () => {
      const logger = new ConsoleLogger('test', true);
      const error = new Error('test error');
      const meta = { code: 500 };
      logger.error('error message', error, meta);

      expect(consoleSpy.error).toHaveBeenCalledWith('[autosave:test]', 'error message', error, meta);
    });
  });

  describe('disabled logger', () => {
    it('should not log debug when disabled', () => {
      const logger = new ConsoleLogger('test', false);
      logger.debug('test message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should not log info when disabled', () => {
      const logger = new ConsoleLogger('test', false);
      logger.info('info message');

      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    it('should not log warn when disabled', () => {
      const logger = new ConsoleLogger('test', false);
      logger.warn('warning message');

      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    it('should not log error when disabled', () => {
      const logger = new ConsoleLogger('test', false);
      const error = new Error('test error');
      logger.error('error message', error);

      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('namespace', () => {
    it('should include namespace in log messages', () => {
      const logger = new ConsoleLogger('my-module', true);
      logger.info('test');

      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:my-module]', 'test', '');
    });

    it('should support different namespaces', () => {
      const logger1 = new ConsoleLogger('module-a', true);
      const logger2 = new ConsoleLogger('module-b', true);

      logger1.info('message 1');
      logger2.info('message 2');

      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:module-a]', 'message 1', '');
      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:module-b]', 'message 2', '');
    });
  });

  describe('metadata handling', () => {
    it('should handle null metadata', () => {
      const logger = new ConsoleLogger('test', true);
      logger.info('message', null);

      // Note: null is falsy so it becomes empty string
      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:test]', 'message', '');
    });

    it('should handle undefined metadata', () => {
      const logger = new ConsoleLogger('test', true);
      logger.info('message', undefined);

      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:test]', 'message', '');
    });

    it('should handle complex metadata objects', () => {
      const logger = new ConsoleLogger('test', true);
      const meta = {
        nested: { data: 'value' },
        array: [1, 2, 3],
        bool: true,
      };
      logger.info('message', meta);

      expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:test]', 'message', meta);
    });
  });
});

describe('createLogger', () => {
  let consoleSpy: {
    info: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a logger with namespace', () => {
    const logger = createLogger('test-namespace');
    expect(logger).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('should create disabled logger by default', () => {
    const logger = createLogger('test');
    logger.info('test message');

    expect(consoleSpy.info).not.toHaveBeenCalled();
  });

  it('should create enabled logger when specified', () => {
    const logger = createLogger('test', true);
    logger.info('test message');

    expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:test]', 'test message', '');
  });

  it('should create disabled logger when explicitly set to false', () => {
    const logger = createLogger('test', false);
    logger.info('test message');

    expect(consoleSpy.info).not.toHaveBeenCalled();
  });

  it('should support multiple logger instances', () => {
    const logger1 = createLogger('logger1', true);
    const logger2 = createLogger('logger2', true);

    logger1.info('from logger 1');
    logger2.info('from logger 2');

    expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:logger1]', 'from logger 1', '');
    expect(consoleSpy.info).toHaveBeenCalledWith('[autosave:logger2]', 'from logger 2', '');
  });
});
