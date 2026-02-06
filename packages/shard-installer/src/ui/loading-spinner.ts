export interface LoadingSpinnerOptions {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner(
  container: HTMLElement,
  options?: LoadingSpinnerOptions,
): HTMLDivElement {
  const wrapper = container.createDiv("shard-loading-spinner");

  // Size
  if (options?.size) {
    wrapper.addClass(`shard-loading-spinner--${options.size}`);
  }

  // Spinner icon
  wrapper.createDiv("shard-loading-spinner__icon");

  // Text
  if (options?.text) {
    wrapper.createDiv({
      text: options.text,
      cls: "shard-loading-spinner__text",
    });
  }

  return wrapper;
}
