import * as vscode from "vscode";
import type { ILogger } from "../interfaces/ILogger";
import type { ISelectionService } from "../interfaces/ISelectionService";
import type { IAnnotationService } from "../interfaces/IAnnotationService";

export class DecorationService implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor(
    private readonly logger: ILogger,
    private readonly selectionService: ISelectionService,
    private readonly annotationService: IAnnotationService,
  ) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 213, 79, 0.15)",
      border: "1px dashed rgba(255, 167, 38, 0.5)",
    });
  }

  refreshDecorations(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.fsPath;
    const selections = this.selectionService
      .getSelections()
      .filter((s) => s.filePath === filePath);
    const annotations = this.annotationService.getAnnotations();

    const decorations: vscode.DecorationOptions[] = [];

    for (const sel of selections) {
      const selAnnotations = annotations.filter(
        (a) => a.selectionId === sel.id,
      );
      if (selAnnotations.length === 0) {
        continue;
      }

      const noteText = selAnnotations.map((a) => a.note).join(" | ");
      const range = new vscode.Range(
        sel.startLine - 1,
        0,
        sel.endLine - 1,
        Number.MAX_SAFE_INTEGER,
      );

      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: `  // ${noteText}`,
            color: "rgba(255, 167, 38, 0.8)",
            fontStyle: "italic",
          },
        },
        hoverMessage: new vscode.MarkdownString(
          `**Directive:** ${noteText}`,
        ),
      });
    }

    editor.setDecorations(this.decorationType, decorations);
    this.logger.info(
      `Decorations refreshed: ${decorations.length} annotation(s) in ${filePath}`,
    );
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
