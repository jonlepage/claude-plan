import type { Annotation } from "../models/Annotation";
import type { Selection } from "../models/Selection";

export interface ICommunicationService {
  send(
    fileName: string,
    selections: ReadonlyArray<Selection>,
    annotations: ReadonlyArray<Annotation>,
  ): Promise<void>;
  isConnected(): boolean;
}
