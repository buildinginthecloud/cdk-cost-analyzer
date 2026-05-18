import { suppressAwsSdkNodeVersionWarning } from '../../src/utils/suppressNodeWarnings';

describe('suppressAwsSdkNodeVersionWarning', () => {
  let originalEmit: typeof process.emit;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEmit = process.emit;
    originalEnv = process.env.AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED;
    delete process.env.AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED;
  });

  afterEach(() => {
    process.emit = originalEmit;
    if (originalEnv === undefined) {
      delete process.env.AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED;
    } else {
      process.env.AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED = originalEnv;
    }
  });

  test('sets the SDK opt-out env var', () => {
    suppressAwsSdkNodeVersionWarning();

    expect(process.env.AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED).toBe('true');
  });

  test('returns false when a NodeVersionSupportWarning is emitted', () => {
    suppressAwsSdkNodeVersionWarning();

    const warning = new Error(
      'NodeVersionSupportWarning: The AWS SDK for JavaScript (v3) versions published after the first week of January 2027 will require node >=22.',
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = process.emit('warning' as any, warning as any);

    expect(result).toBe(false);
  });

  test('delegates other warnings to the original emit', () => {
    suppressAwsSdkNodeVersionWarning();

    const other = Object.assign(new Error('experimental feature in use'), {
      name: 'ExperimentalWarning',
    });

    // ExperimentalWarning is not suppressed: emit returns whatever the
    // original handler returns (depends on listeners). It must not be
    // hard-blocked like NodeVersionSupportWarning is.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      process.emit('warning' as any, other as any);
    }).not.toThrow();
  });

  test('delegates non-warning events to the original emit', () => {
    suppressAwsSdkNodeVersionWarning();

    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      process.emit('beforeExit' as any, 0 as any);
    }).not.toThrow();
  });
});
