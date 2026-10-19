export const environmentNames = ["development", "staging", "production"] as const;
export type EnvironmentName = (typeof environmentNames)[number];

export interface EnvironmentConfig {
  name: EnvironmentName;
  stackPrefix: string;
  terminationProtection: boolean;
  allowedOrigins: string[];
  awsBudgetUsd: number | null;
}

export function getEnvironmentConfig(value: unknown): EnvironmentConfig {
  const name = value ?? "development";
  if (typeof name !== "string" || !environmentNames.includes(name as EnvironmentName)) {
    throw new Error(`environment must be one of: ${environmentNames.join(", ")}`);
  }

  return {
    name: name as EnvironmentName,
    stackPrefix: `Dennie-${name}`,
    terminationProtection: name === "production",
    allowedOrigins: name === "production"
      ? ["https://dandinh.net"]
      : ["https://dandinh.net", "http://localhost:3000"],
    awsBudgetUsd: null,
  };
}
