/** Edition/capability gates — UI only; server remains authoritative. */

export type Capability =
  | "gl"
  | "treasury"
  | "arap"
  | "sales"
  | "inventory"
  | "assets"
  | "tax"
  | "budget"
  | "costing"
  | "payroll"
  | "manufacturing"
  | "reporting"
  | "enterprise"
  | "ai";

const DEFAULT_CAPABILITIES: Capability[] = [
  "gl",
  "treasury",
  "arap",
  "sales",
  "inventory",
  "assets",
  "tax",
  "budget",
  "costing",
  "payroll",
  "manufacturing",
  "reporting",
  "enterprise",
  "ai",
];

export function hasCapability(cap: Capability, granted: Capability[] = DEFAULT_CAPABILITIES): boolean {
  return granted.includes(cap);
}

export function canPostFinancial(granted: Capability[] = DEFAULT_CAPABILITIES): boolean {
  return hasCapability("gl", granted);
}
