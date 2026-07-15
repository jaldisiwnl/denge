/** Fills "{name}" placeholders in a template string from tr.ts. */
export function ti(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}
