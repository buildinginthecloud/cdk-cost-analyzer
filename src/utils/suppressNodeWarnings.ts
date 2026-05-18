/**
 * Suppress AWS SDK Node-version warnings so they do not end up in piped
 * output (for example CI pipelines that redirect stderr into a PR/MR
 * comment). All other process warnings keep flowing through normally.
 *
 * Two complementary mechanisms:
 *
 *   1. Set the official SDK opt-out env var. Recent versions of
 *      @aws-sdk/core check `AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED`
 *      and skip the warning entirely when it is "true".
 *
 *   2. As a fallback for SDK versions that pre-date the env var, monkey-patch
 *      `process.emit` to drop only warnings whose message starts with
 *      "NodeVersionSupportWarning". Every other warning is forwarded to
 *      the original emit.
 *
 * Call once, as early as possible in an entry-point script.
 */
export function suppressAwsSdkNodeVersionWarning(): void {
  process.env.AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED = 'true';

  const originalEmit = process.emit.bind(process);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process as any).emit = function (name: string, ...args: any[]): boolean {
    if (name === 'warning') {
      const warning = args[0];
      const message: string = typeof warning?.message === 'string' ? warning.message : '';
      if (message.startsWith('NodeVersionSupportWarning')) {
        return false;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalEmit as any)(name, ...args);
  };
}
