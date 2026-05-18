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
export declare function suppressAwsSdkNodeVersionWarning(): void;
