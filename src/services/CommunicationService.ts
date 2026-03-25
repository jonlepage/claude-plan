import type { ICommunicationService } from "../interfaces/ICommunicationService";
import type { ILogger } from "../interfaces/ILogger";
import type { Annotation } from "../models/Annotation";

export class CommunicationService implements ICommunicationService {
  constructor(private readonly logger: ILogger) {}

  async send(annotations: ReadonlyArray<Annotation>): Promise<void> {
    this.logger.info(`CommunicationService.send called with ${annotations.length} annotation(s) — noop for now.`);
  }

  isConnected(): boolean {
    return false;
  }
}
