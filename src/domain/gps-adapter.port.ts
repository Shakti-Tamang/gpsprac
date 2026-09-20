import { NormalizedPosition } from './normalized-position.js';

export abstract class GpsAdapterPort {
  abstract getProviderName(): string;
  abstract fetchPositions(): Promise<NormalizedPosition[]>;
}
