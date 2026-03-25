import * as vscode from "vscode";
import * as path from "path";
import type { ILogger } from "../interfaces/ILogger";
import type { ISelectionService } from "../interfaces/ISelectionService";
import type { IAnnotationService } from "../interfaces/IAnnotationService";
import type { ICommunicationService } from "../interfaces/ICommunicationService";
import type { DecorationService } from "../services/DecorationService";

interface PreviewSelectionArgs {
	text: string;
	startLine: number;
	endLine: number;
}

export interface CommandDependencies {
	readonly logger: ILogger;
	readonly selectionService: ISelectionService;
	readonly annotationService: IAnnotationService;
	readonly communicationService: ICommunicationService;
	readonly decorationService: DecorationService;
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

		// Accepts args from: 1) command URI (preview) or 2) no args (editor context menu)
		vscode.commands.registerCommand(
			"claudePlan.addAnnotation",
			async (previewArgs?: PreviewSelectionArgs) => {
				deps.logger.info(
					`Command: addAnnotation triggered (source: ${previewArgs ? "preview" : "editor"})`,
				);

				let selection;

				if (previewArgs) {
					// Called from markdown preview via command URI
					const filePath = getActiveFilePath();
					deps.logger.info(
						`Preview selection: lines ${previewArgs.startLine}-${previewArgs.endLine}, "${previewArgs.text.substring(0, 80)}..."`,
					);
					selection = deps.selectionService.registerSelection(
						filePath,
						previewArgs.startLine,
						previewArgs.endLine,
						previewArgs.text,
					);
				} else {
					// Called from editor context menu
					selection = deps.selectionService.captureSelection();
				}

				if (!selection) {
					deps.logger.warn("addAnnotation: no selection available");
					vscode.window.showWarningMessage("Select text first.");
					return;
				}

				const note = await vscode.window.showInputBox({
					prompt: "Directive or comment for this selection",
					placeHolder:
						"e.g. This section needs more detail about error handling",
				});

				if (!note) {
					deps.logger.warn("addAnnotation: user cancelled input");
					return;
				}

				const annotation = deps.annotationService.addAnnotation(
					selection,
					note,
				);
				deps.logger.info(
					`Annotation created: ${annotation.id} → lines ${selection.startLine}-${selection.endLine}: "${note}"`,
				);

				// Refresh editor decorations if in source mode
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					deps.decorationService.refreshDecorations(editor);
				}

				vscode.window.showInformationMessage("Directive added.");
			},
		),

		vscode.commands.registerCommand("claudePlan.sendToClaude", async () => {
			deps.logger.info("Command: sendToClaude triggered");

			let prompt: string | undefined;

			// Source editor mode: build prompt from extension state
			const annotations = deps.annotationService.getAnnotations();
			if (annotations.length > 0) {
				const selections = deps.selectionService.getSelections();
				const fileName = getActiveFileName();
				const { buildAnnotatedSelections, buildPrompt } =
					await import("../utils/promptBuilder");
				const annotated = buildAnnotatedSelections(selections, annotations);
				prompt = buildPrompt(fileName, annotated);
			} else {
				// Preview mode: read from clipboard (webview auto-syncs)
				const clipboard = await vscode.env.clipboard.readText();
				if (clipboard.startsWith("fix:plan")) {
					prompt = clipboard;
				}
			}

			if (!prompt) {
				vscode.window.showWarningMessage(
					"No directives found. Add directives in the preview first.",
				);
				return;
			}

			deps.logger.info(`sendToClaude: sending prompt (${prompt.length} chars)`);
			deps.logger.info(`Prompt:\n${prompt}`);

			// Save current clipboard, set prompt
			const savedClipboard = await vscode.env.clipboard.readText();
			await vscode.env.clipboard.writeText(prompt);

			try {
				// Focus existing Claude Code chat input
				await vscode.commands.executeCommand("claude-vscode.focus");
				deps.logger.info("Claude Code input focused");

				// Wait for focus to settle
				await new Promise((r) => setTimeout(r, 150));

				// Simulate Ctrl+V at OS level (works on webview inputs)
				const { exec } = await import("child_process");
				exec(
					"powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')\"",
					(err) => {
						if (err) {
							deps.logger.error("SendKeys failed", err);
						} else {
							deps.logger.info("Prompt pasted into Claude Code chat");
						}
						// Restore clipboard after paste completes
						setTimeout(() => {
							vscode.env.clipboard.writeText(savedClipboard);
						}, 150);
					},
				);
			} catch {
				deps.logger.warn(
					"claude-vscode.focus not available, fallback to clipboard",
				);
				vscode.window.showInformationMessage(
					"Directives copied! Paste into the Claude Code chat (Ctrl+V).",
				);
			}
		}),

		vscode.commands.registerCommand("claudePlan.clearAll", () => {
			deps.logger.info("Command: clearAll triggered");

			deps.selectionService.clearSelections();
			deps.annotationService.clearAnnotations();

			const editor = vscode.window.activeTextEditor;
			if (editor) {
				deps.decorationService.refreshDecorations(editor);
			}

			deps.logger.info("All selections and annotations cleared");
			vscode.window.showInformationMessage("All directives cleared.");
		}),
	);
}

function getActiveFilePath(): string {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		return editor.document.uri.fsPath;
	}
	// In preview mode, try visible text editors
	const visible = vscode.window.visibleTextEditors.find(
		(e) => e.document.languageId === "markdown",
	);
	return visible?.document.uri.fsPath ?? "plan.md";
}

function getActiveFileName(): string {
	return path.basename(getActiveFilePath());
}
