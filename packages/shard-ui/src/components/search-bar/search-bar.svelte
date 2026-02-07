<script lang="ts" generics="T extends Record<string, any>">
  import { cn } from '$lib/utils';

  interface Props {
    /** Current search query */
    query?: string;
    /** Search results to display */
    results?: T[];
    /** Whether to show the results dropdown */
    showResults?: boolean;
    /** Placeholder text for the input */
    placeholder?: string;
    /** Callback when query changes */
    onQueryChange?: (query: string) => void;
    /** Callback when a result is selected */
    onResultSelect?: (result: T) => void;
    /** Callback when input gains focus */
    onFocus?: () => void;
    /** Callback when input loses focus */
    onBlur?: () => void;
    /** Function to render a result item's title */
    getResultTitle?: (result: T) => string;
    /** Function to render a result item's subtitle */
    getResultSubtitle?: (result: T) => string;
    /** Function to render a result item's description */
    getResultDescription?: (result: T) => string;
    /** Custom CSS class */
    class?: string;
    /** Debounce delay in milliseconds */
    debounceMs?: number;
  }

  let {
    query = $bindable(''),
    results = [],
    showResults = $bindable(false),
    placeholder = 'Search...',
    onQueryChange,
    onResultSelect,
    onFocus,
    onBlur,
    getResultTitle = (result: T) => result.name ?? '',
    getResultSubtitle = (result: T) => result.author ?? '',
    getResultDescription = (result: T) => result.description ?? '',
    class: className,
    debounceMs = 300
  }: Props = $props();

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    query = target.value;

    // Debounce search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      onQueryChange?.(query);
    }, debounceMs);
  }

  function handleFocus() {
    onFocus?.();
  }

  function handleBlur() {
    // Delay hiding results to allow clicking on them
    setTimeout(() => {
      onBlur?.();
    }, 200);
  }

  function handleResultClick(result: T) {
    onResultSelect?.(result);
  }
</script>

<div class={cn('relative w-full max-w-xl', className)}>
  <div class="relative">
    <input
      type="text"
      value={query}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      {placeholder}
      class="w-full rounded-md border border-input bg-background px-4 py-2 pr-10 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    />
    <svg
      class="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  </div>

  {#if showResults && results.length > 0}
    <div
      class="absolute z-10 mt-2 max-h-96 w-full overflow-y-auto rounded-md border bg-background shadow-lg"
    >
      {#each results as result}
        <button
          class="w-full border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent"
          onclick={() => handleResultClick(result)}
        >
          <p class="font-semibold">{getResultTitle(result)}</p>
          {#if getResultSubtitle(result)}
            <p class="text-sm text-muted-foreground">
              {getResultSubtitle(result)}
            </p>
          {/if}
          {#if getResultDescription(result)}
            <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {getResultDescription(result)}
            </p>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if showResults && query.trim() && results.length === 0}
    <div
      class="absolute z-10 mt-2 w-full rounded-md border bg-background p-4 shadow-lg"
    >
      <p class="text-sm text-muted-foreground">No results found</p>
    </div>
  {/if}
</div>
