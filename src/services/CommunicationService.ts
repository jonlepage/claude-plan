import * as vscode from "vscode";
import type { ICommunicationService } from "../interfaces/ICommunicationService";
import type { ILogger } from "../interfaces/ILogger";
import type { Annotation } from "../models/Annotation";
import type { Selection } from "../models/Selection";
import { buildAnnotatedSelections, buildPrompt } from "../utils/promptBuilder";

export class CommunicationService implements ICommunicationService {
	constructor(private readonly logger: ILogger) {}

	async send(
		fileName: string,
		selections: ReadonlyArray<Selection>,
		annotations: ReadonlyArray<Annotation>,
	): Promise<void> {
		const annotated = buildAnnotatedSelections(selections, annotations);
		const prompt = buildPrompt(fileName, annotated);

		this.logger.info(
			`Sending ${annotations.length} directive(s) for ${fileName}`,
		);
		this.logger.info(`Prompt:\n${prompt}`);

		await vscode.env.clipboard.writeText(prompt);
		vscode.window.showInformationMessage(
			"Directives copied to clipboard. Paste them into your terminal to execute.",
		);
	}

	isConnected(): boolean {
		return true;
	}
}
