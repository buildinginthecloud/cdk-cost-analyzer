/**
 * Suppress the AWS SDK NodeDeprecationWarning so it does not end up in
 * piped output (for example CI pipelines that redirect stderr into a
 * PR/MR comment). All other process warnings are preserved.
 *
 * Call once, as early as possible in an entry-point script.
 */
export function suppressNodeDeprecationWarning(): void {
  const originalEmit = process.emit.bind(process);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process as any).emit = function (name: string, ...args: any[]): boolean {
    if (name === 'warning' && args[0]?.name === 'NodeDeprecationWarning') {
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalEmit as any)(name, ...args);
  };
}
