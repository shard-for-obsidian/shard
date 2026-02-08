import { Button } from "./button";

export interface ErrorBannerOptions {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner(
  container: HTMLElement,
  options: ErrorBannerOptions,
): HTMLDivElement {
  const banner = container.createDiv("shard-error-banner");

  // Title
  banner.createEl("strong", {
    text: options.title,
    cls: "shard-error-banner__title",
  });

  // Message
  banner.createDiv({
    text: options.message,
    cls: "shard-error-banner__message",
  });

  // Retry button
  if (options.onRetry) {
    const actions = banner.createDiv("shard-error-banner__actions");
    Button(actions, {
      text: "Retry",
      variant: "secondary",
      size: "sm",
      onClick: options.onRetry,
    });
  }

  return banner;
}
