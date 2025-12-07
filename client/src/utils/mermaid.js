let mermaidPromise;

export async function loadMermaid(config) {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => mermaid);
  }
  const mermaid = await mermaidPromise;
  if (config) {
    mermaid.initialize(config);
  }
  return mermaid;
}
