<script lang="ts">
	import { MarkdownRenderer } from "obsidian";
	import { log } from "src/logger";
	import type BreadcrumbsPlugin from "src/main";
	import { active_file_store } from "src/stores/active_file";

	export let cls = "";
	export let markdown: string;
	export let plugin: BreadcrumbsPlugin;
	export let source_path: string | undefined = undefined;

	let el: HTMLElement | undefined;

	// we need to pass both the mermaid string and the target element, so that it re-renders when the mermaid string changes
	// and for the initial render the target element is undefined, so we need to check for that
	const render = (markdown: string, el: HTMLElement | undefined) => {
		if (!el) return;

		log.debug("rendering markdown");

		el.empty();

		MarkdownRenderer.render(
			plugin.app,
			markdown,
			el,
			source_path ?? $active_file_store?.path ?? "",
			plugin,
		);
	};

	$: render(markdown, el);
</script>

<div class="markdown-rendered {cls}" bind:this={el}></div>
