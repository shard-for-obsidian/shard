export interface VersionListItemOptions {
  tag: string;
  isCurrent: boolean;
  actionText: string;
  onSelect: (tag: string) => void;
}

export function VersionListItem(
  container: HTMLElement,
  options: VersionListItemOptions,
): HTMLDivElement {
  const { tag, isCurrent, actionText, onSelect } = options;

  const item = container.createDiv("shard-version-item clickable-item");

  if (isCurrent) {
    item.addClass("is-active");
  }

  const info = item.createDiv("shard-version-item__info");

  // Tag name
  const tagName = info.createDiv("shard-version-item__tag");
  tagName.setText(tag);

  if (isCurrent) {
    tagName.createSpan({
      text: " (current)",
      cls: "shard-version-item__current-badge",
    });
  }

  // Action hint
  info.createDiv({
    text: actionText,
    cls: "shard-version-item__hint",
  });

  // Click handler
  item.onclick = () => onSelect(tag);

  return item;
}
