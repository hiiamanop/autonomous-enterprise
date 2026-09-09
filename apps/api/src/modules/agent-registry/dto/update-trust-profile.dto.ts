export class UpdateTrustProfileDto {
  accuracy?: number;
  consistency?: number;
  calibration?: number;
  historicalSuccessRate?: number;
  failureRate?: number;
  policyViolations?: number;
  overallTrust?: number;
  sampleCount?: number;
}
