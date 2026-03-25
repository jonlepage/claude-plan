import { randomUUID } from "crypto";
import type { IAnnotationService } from "../interfaces/IAnnotationService";
import type { ILogger } from "../interfaces/ILogger";
import type { Annotation } from "../models/Annotation";
import type { Selection } from "../models/Selection";

export class AnnotationService implements IAnnotationService {
  private readonly annotations: Annotation[] = [];

  constructor(private readonly logger: ILogger) {}

  addAnnotation(selection: Selection, note: string): Annotation {
    const annotation: Annotation = {
      id: randomUUID(),
      selectionId: selection.id,
      note,
      createdAt: Date.now(),
    };

    this.annotations.push(annotation);
    this.logger.info(`Annotation added for selection ${selection.id}`);
    return annotation;
  }

  getAnnotations(): ReadonlyArray<Annotation> {
    return this.annotations;
  }

  removeAnnotation(id: string): boolean {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) {
      return false;
    }
    this.annotations.splice(index, 1);
    this.logger.info(`Annotation ${id} removed.`);
    return true;
  }

  clearAnnotations(): void {
    this.annotations.length = 0;
    this.logger.info("All annotations cleared.");
  }
}
