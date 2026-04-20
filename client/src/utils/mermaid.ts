import type { MermaidConfig } from 'mermaid';

type MermaidModule = typeof import('mermaid');

let mermaidPromise: Promise<MermaidModule['default']> | undefined;

export const loadMermaid = async (config?: MermaidConfig): Promise<MermaidModule['default']> => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => mermaid);
  }
  const mermaid = await mermaidPromise;
  if (config) {
    mermaid.initialize(config);
  }
  return mermaid;
};
