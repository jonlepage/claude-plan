import * as vscode from "vscode";
import type { ILogger } from "../interfaces/ILogger";

export class LoggerService implements ILogger {
  private readonly channel: vscode.OutputChannel;

  constructor(channelName: string) {
    this.channel = vscode.window.createOutputChannel(channelName);
  }

  info(message: string): void {
    this.channel.appendLine(`[INFO]  ${message}`);
  }

  warn(message: string): void {
    this.channel.appendLine(`[WARN]  ${message}`);
  }

  error(message: string, err?: Error): void {
    this.channel.appendLine(`[ERROR] ${message}`);
    if (err?.stack) {
      this.channel.appendLine(err.stack);
    }
  }

  dispose(): void {
    this.channel.dispose();
  }
}
