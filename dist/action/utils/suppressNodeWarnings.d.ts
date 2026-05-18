/**
 * Suppress the AWS SDK NodeDeprecationWarning so it does not end up in
 * piped output (for example CI pipelines that redirect stderr into a
 * PR/MR comment). All other process warnings are preserved.
 *
 * Call once, as early as possible in an entry-point script.
 */
export declare function suppressNodeDeprecationWarning(): void;
