import type * as vscode from "vscode";
import { type Container, createContainer } from "./container";

let container: Container | undefined;

export function activate(context: vscode.ExtensionContext): void {
  container = createContainer(context);
  container.logger.info("Claude Plan extension activated.");
}

export function deactivate(): void {
  container?.dispose();
  container = undefined;
}
