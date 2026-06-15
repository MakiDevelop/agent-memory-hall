export class CallerNamespaceRequiredError extends Error {
  constructor() {
    super(
      "Namespace isolation is enabled but no trusted caller_namespace is configured. " +
        "Set caller_namespace in ~/.amh/config.json or start the server with --caller-ns."
    );
    this.name = "CallerNamespaceRequiredError";
  }
}

export function requireTrustedCaller(
  namespaceIsolation: boolean | undefined,
  callerNamespace: string | undefined
): void {
  if (namespaceIsolation && !callerNamespace) {
    throw new CallerNamespaceRequiredError();
  }
}