import type { Selection } from "../models/Selection";

export interface ISelectionService {
  captureSelection(): Selection | undefined;
  registerSelection(filePath: string, startLine: number, endLine: number, text: string): Selection;
  getSelections(): ReadonlyArray<Selection>;
  clearSelections(): void;
}
