import { episodeCheckpointSchema } from "./episode-runtime.js";
import type { EpisodeCheckpoint } from "./episode-runtime.js";

export interface EpisodeCheckpointAdapter {
  save(checkpoint: EpisodeCheckpoint): Promise<void>;
  load(episodeId: string): Promise<EpisodeCheckpoint | null>;
}

export class InMemoryCheckpointAdapter implements EpisodeCheckpointAdapter {
  private readonly store = new Map<string, EpisodeCheckpoint>();

  get size(): number {
    return this.store.size;
  }

  save(checkpoint: EpisodeCheckpoint): Promise<void> {
    episodeCheckpointSchema.parse(checkpoint);
    const key = checkpoint.runtime.episodeId;
    this.store.set(key, structuredClone(checkpoint));
    return Promise.resolve();
  }

  load(episodeId: string): Promise<EpisodeCheckpoint | null> {
    const found = this.store.get(episodeId);
    return Promise.resolve(found === undefined ? null : structuredClone(found));
  }
}

export function createInMemoryCheckpointAdapter(): InMemoryCheckpointAdapter {
  return new InMemoryCheckpointAdapter();
}
