export interface ListOptions {
  gap?: "sm" | "md" | "lg";
}

export function List(
  container: HTMLElement,
  options?: ListOptions,
): HTMLDivElement {
  const list = container.createDiv("shard-list");

  // Gap
  if (options?.gap) {
    list.addClass(`shard-list--gap-${options.gap}`);
  }

  return list;
}
