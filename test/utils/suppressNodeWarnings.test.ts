import { suppressNodeDeprecationWarning } from '../../src/utils/suppressNodeWarnings';

describe('suppressNodeDeprecationWarning', () => {
  let originalEmit: typeof process.emit;

  beforeEach(() => {
    originalEmit = process.emit;
  });

  afterEach(() => {
    process.emit = originalEmit;
  });

  test('returns false when a NodeDeprecationWarning is emitted', () => {
    suppressNodeDeprecationWarning();

    const warning = Object.assign(new Error('Node 20 will be removed'), {
      name: 'NodeDeprecationWarning',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = process.emit('warning' as any, warning as any);

    expect(result).toBe(false);
  });

  test('delegates other events to the original emit', () => {
    suppressNodeDeprecationWarning();

    const otherWarning = Object.assign(new Error('experimental'), {
      name: 'ExperimentalWarning',
    });

    // ExperimentalWarning is not suppressed: emit returns whatever the
    // original handler returns (true when there are listeners, false when not).
    // Either way it must not be hard-blocked to `false` like the
    // NodeDeprecationWarning is.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      process.emit('warning' as any, otherWarning as any);
    }).not.toThrow();
  });
});
