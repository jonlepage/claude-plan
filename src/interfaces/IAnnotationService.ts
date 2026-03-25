import type { Annotation } from "../models/Annotation";
import type { Selection } from "../models/Selection";

export interface IAnnotationService {
  addAnnotation(selection: Selection, note: string): Annotation;
  getAnnotations(): ReadonlyArray<Annotation>;
  removeAnnotation(id: string): boolean;
  clearAnnotations(): void;
}
