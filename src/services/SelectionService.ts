import * as vscode from "vscode";
import { randomUUID } from "crypto";
import type { ISelectionService } from "../interfaces/ISelectionService";
import type { ILogger } from "../interfaces/ILogger";
import type { Selection } from "../models/Selection";

export class SelectionService implements ISelectionService {
  private readonly selections: Selection[] = [];

  constructor(private readonly logger: ILogger) {}

  captureSelection(): Selection | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      return undefined;
    }

    const selection: Selection = {
      id: randomUUID(),
      filePath: editor.document.uri.fsPath,
      startLine: editor.selection.start.line + 1,
      endLine: editor.selection.end.line + 1,
      text: editor.document.getText(editor.selection),
      timestamp: Date.now(),
    };

    this.selections.push(selection);
    this.logger.info(`Selection captured: ${selection.filePath}:${selection.startLine}-${selection.endLine}`);
    return selection;
  }

  getSelections(): ReadonlyArray<Selection> {
    return this.selections;
  }

  clearSelections(): void {
    this.selections.length = 0;
    this.logger.info("All selections cleared.");
  }
}
