export interface Selection {
  readonly id: string;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly text: string;
  readonly timestamp: number;
}
