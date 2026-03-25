import type { Selection } from "../models/Selection";

export interface ISelectionService {
  captureSelection(): Selection | undefined;
  getSelections(): ReadonlyArray<Selection>;
  clearSelections(): void;
}
