export interface CardOptions {
  variant?: "default" | "elevated" | "outlined";
  clickable?: boolean;
  onClick?: () => void;
}

export interface CardElement extends HTMLDivElement {
  header: HTMLDivElement;
  body: HTMLDivElement;
  footer: HTMLDivElement;
}

export function Card(
  container: HTMLElement,
  options?: CardOptions,
): CardElement {
  const card = container.createDiv("shard-card") as CardElement;

  // Variant
  if (options?.variant) {
    card.addClass(`shard-card--${options.variant}`);
  }

  // Clickable
  if (options?.clickable) {
    card.addClass("shard-card--clickable");
  }

  // Click handler
  if (options?.onClick) {
    card.onclick = options.onClick;
  }

  // Create sections
  card.header = card.createDiv("shard-card__header");
  card.body = card.createDiv("shard-card__body");
  card.footer = card.createDiv("shard-card__footer");

  return card;
}
