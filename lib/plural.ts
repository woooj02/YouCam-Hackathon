/** "1 hard conflict", "2 hard conflicts", "1 gap". Pass the plural when it isn't +s. */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : pluralForm}`;
}
