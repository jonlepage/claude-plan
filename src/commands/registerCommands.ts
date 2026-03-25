import * as vscode from "vscode";
import type { ILogger } from "../interfaces/ILogger";
import type { ISelectionService } from "../interfaces/ISelectionService";
import type { IAnnotationService } from "../interfaces/IAnnotationService";
import type { ICommunicationService } from "../interfaces/ICommunicationService";

export interface CommandDependencies {
  readonly logger: ILogger;
  readonly selectionService: ISelectionService;
  readonly annotationService: IAnnotationService;
  readonly communicationService: ICommunicationService;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("claudePlan.showInfo", () => {
      const selectionCount = deps.selectionService.getSelections().length;
      const annotationCount = deps.annotationService.getAnnotations().length;
      const connected = deps.communicationService.isConnected();

      vscode.window.showInformationMessage(
        `Claude Plan — Selections: ${selectionCount}, Annotations: ${annotationCount}, Connected: ${connected}`,
      );
    }),
  );
}
