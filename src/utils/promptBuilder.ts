import type { Selection } from "../models/Selection";
import type { Annotation } from "../models/Annotation";

export interface AnnotatedSelection {
  selection: Selection;
  annotations: Annotation[];
}

export function buildAnnotatedSelections(
  selections: ReadonlyArray<Selection>,
  annotations: ReadonlyArray<Annotation>,
): AnnotatedSelection[] {
  return selections
    .map((selection) => ({
      selection,
      annotations: annotations.filter((a) => a.selectionId === selection.id),
    }))
    .filter((entry) => entry.annotations.length > 0);
}

export function buildPrompt(
  fileName: string,
  annotatedSelections: AnnotatedSelection[],
): string {
  const header = `fix:plan (${fileName})`;
  const directives = annotatedSelections.flatMap(({ selection, annotations }) =>
    annotations.map((a) => {
      let excerpt = selection.text.substring(0, 80).replace(/\s+/g, " ");
      if (selection.text.length > 80) excerpt += "...";
      return `> "${excerpt}" (~line ${selection.startLine}): ${a.note}`;
    }),
  );
  return [header, ...directives].join("\n");
}
