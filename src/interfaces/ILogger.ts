import type { Disposable } from "vscode";

export interface ILogger extends Disposable {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, err?: Error): void;
}
