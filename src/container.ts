import type * as vscode from "vscode";
import { LoggerService, SelectionService, AnnotationService, CommunicationService } from "./services";
import { registerCommands } from "./commands";
import { DisposableCollection } from "./utils";

export interface Container {
  readonly logger: LoggerService;
  dispose(): void;
}

export function createContainer(context: vscode.ExtensionContext): Container {
  const disposables = new DisposableCollection();

  const logger = disposables.add(new LoggerService("Claude Plan"));
  const selectionService = new SelectionService(logger);
  const annotationService = new AnnotationService(logger);
  const communicationService = new CommunicationService(logger);

  registerCommands(context, {
    logger,
    selectionService,
    annotationService,
    communicationService,
  });

  return {
    logger,
    dispose: () => disposables.dispose(),
  };
}
