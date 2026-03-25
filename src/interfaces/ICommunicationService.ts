import type { Annotation } from "../models/Annotation";

export interface ICommunicationService {
  send(annotations: ReadonlyArray<Annotation>): Promise<void>;
  isConnected(): boolean;
}
