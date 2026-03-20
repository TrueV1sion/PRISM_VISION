/**
 * Legacy HTML Post-Processing
 *
 * Extracted from executor.ts for testability. Handles CSS/JS inlining,
 * design-system cleanup, and truncation recovery for legacy
 * (non-template) presentation pipeline output.
 */

import { readFileSync } from "fs";
import { join } from "path";

/**
 * Strip embedded `<style>` blocks that the LLM may have generated despite
 * the spec instruction "Do NOT write any inline <style> tags."
 * These override the canonical design system CSS and cause token drift.
 */
export function stripEmbeddedStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
}

/**
 * Inject CSS into the HTML `<head>`. Strips any external `<link>` reference
 * to presentation.css, then inlines the file contents as a `<style>` block.
 * Falls back to a `<link>` tag if the file doesn't exist on disk.
 */
export function injectCSS(html: string, cssPath: string): string {
  if (!html.includes("</head>")) return html;

  // Strip any existing external <link> referencing presentation.css
  const processed = html.replace(
    /<link[^>]*href="[^"]*presentation\.css"[^>]*>\s*/g,
    "",
  );

  try {
    const css = readFileSync(cssPath, "utf-8");
    return processed.replace("</head>", `  <style>\n${css}\n  </style>\n</head>`);
  } catch {
    return processed.replace("</head>", `  <link rel="stylesheet" href="/styles/presentation.css">\n</head>`);
  }
}

/**
 * Inject JS into the HTML `<body>`. Strips any external `<script src>` reference
 * to presentation.js, then inlines the file contents as a `<script>` block.
 * Falls back to a `<script src>` tag if the file doesn't exist on disk.
 */
export function injectJS(html: string, jsPath: string): string {
  if (!html.includes("</body>")) return html;

  // Strip any existing external <script src> referencing presentation.js
  const processed = html.replace(
    /<script[^>]*src="[^"]*presentation\.js"[^>]*><\/script>\s*/g,
    "",
  );

  try {
    const js = readFileSync(jsPath, "utf-8");
    return processed.replace("</body>", `  <script>\n${js}\n  </script>\n</body>`);
  } catch {
    return processed.replace("</body>", `  <script src="/js/presentation.js" defer></script>\n</body>`);
  }
}

/**
 * Bake animation classes so slides render fully-visible in static HTML.
 * Adds "visible" to anim elements, "animate" to bar-fills, "is-visible" to charts.
 */
export function bakeAnimations(html: string): string {
  // Add "visible" to all animation elements (original + enhanced)
  html = html.replace(
    /class="([^"]*\b(anim|anim-scale|anim-blur|anim-slide-left|anim-slide-right|anim-spring|anim-fade|anim-zoom|stagger-children)\b[^"]*)"/g,
    (match, classes) => classes.includes("visible") ? match : `class="${classes} visible"`,
  );

  // Add "animate" to bar-fill elements
  html = html.replace(
    /class="([^"]*\bbar-fill\b[^"]*)"/g,
    (match, classes) => classes.includes("animate") ? match : `class="${classes} animate"`,
  );

  // Add "is-visible" to chart elements
  html = html.replace(
    /class="([^"]*\b(bar-chart|line-chart|donut-chart|sparkline)\b[^"]*)"/g,
    (match, classes) => classes.includes("is-visible") ? match : `class="${classes} is-visible"`,
  );

  return html;
}

/**
 * Bake stat counters so they display their target value in static HTML
 * instead of starting at 0 and waiting for JS animation.
 */
export function bakeCounters(html: string): string {
  // Simple counter: replace inner text with data-target value
  html = html.replace(
    /(<span[^>]*class="[^"]*stat-number[^"]*"[^>]*data-target="(\d+)"[^>]*>)(\d+)(<\/span>)/g,
    (_match, openTag, target, _currentText, closeTag) => `${openTag}${target}${closeTag}`,
  );

  // Counter with prefix/suffix: format with locale separators
  html = html.replace(
    /(<span[^>]*class="[^"]*stat-number[^"]*"[^>]*data-target="(\d+)"[^>]*(?:data-prefix="([^"]*)")?[^>]*(?:data-suffix="([^"]*)")?[^>]*>)(\d+)(<\/span>)/g,
    (_match, openTag, target, prefix, suffix, _currentText, closeTag) => {
      const val = parseInt(target).toLocaleString();
      return `${openTag}${prefix || ""}${val}${suffix || ""}${closeTag}`;
    },
  );

  return html;
}

/**
 * Recover from LLM-generated HTML that was truncated mid-stream.
 * Closes unclosed `<section>` tags and ensures `</body></html>` is present.
 */
export function recoverTruncation(html: string): string {
  if (html.includes("</body>")) return html;

  const openSections = (html.match(/<section/g) || []).length;
  const closedSections = (html.match(/<\/section>/g) || []).length;
  const unclosedSections = openSections - closedSections;

  if (unclosedSections > 0) {
    html += `\n</div></div></section>`.repeat(unclosedSections);
  }

  html += `\n</body>\n</html>`;
  return html;
}

/**
 * Deterministically upgrade animation classes based on element context.
 * Transforms generic .anim into contextually appropriate enhanced classes.
 */
export function enhanceAnimations(html: string): string {
  let p = html;
  // Slide titles → anim-blur
  p = p.replace(/class="([^"]*\bslide-title\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-blur${a}"`);
  // Hero titles → anim-blur
  p = p.replace(/class="([^"]*\bhero-title\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-blur${a}"`);
  // Grid-3 → stagger-children
  p = p.replace(/class="([^"]*\bgrid-3\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /stagger-children/.test(b+a)?m:`class="${b}stagger-children${a}"`);
  // Hero stats → anim-spring
  p = p.replace(/class="([^"]*\bhero-stats\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-spring${a}"`);
  // Source lists → anim-fade
  p = p.replace(/class="([^"]*\bsource-list\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-fade${a}"`);
  // Emergent numbers → anim-zoom
  p = p.replace(/class="([^"]*\bemergent-number\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-zoom${a}"`);
  // Stat cards → anim-scale
  p = p.replace(/class="([^"]*\bstat-card\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-scale${a}"`);
  // Emergence cards → anim-scale
  p = p.replace(/class="([^"]*\bemergence-card\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-scale${a}"`);
  // Dagger footnotes → anim-fade
  p = p.replace(/class="([^"]*\bdagger-footnote\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-fade${a}"`);
  // Validation box → anim-scale
  p = p.replace(/class="([^"]*\bvalidation-box\b[^"]*)\banim\b(?!-)([^"]*)"/g,
    (m,b,a) => /anim-(blur|slide|spring|fade|zoom|scale)/.test(b+a)?m:`class="${b}anim-scale${a}"`);
  return p;
}

/**
 * Add background variant classes to bare <section> elements.
 */
export function addBackgroundVariants(html: string): string {
  const v = ["gradient-dark","gradient-dark","gradient-blue","gradient-blue",
    "dark-particles","gradient-dark","dark-mesh","gradient-blue",
    "dark-particles","gradient-dark","dark-mesh","gradient-blue",
    "dark-particles","gradient-radial","gradient-radial","dark-mesh",
    "gradient-dark","dark-particles","gradient-blue","gradient-dark"];
  let i = 0;
  return html.replace(/<section\s+class="slide"(\s+id="s\d+")/g,
    (_m, id) => { const bg = v[i%v.length]||"gradient-dark"; i++; return `<section class="slide ${bg}"${id}`; });
}

/**
 * Strip inline styles the LLM may have added, keeping only allowed patterns:
 * slide-bg-glow position/background, legend-dot colors, bar-fill --fill-pct, SVG stroke attributes.
 */
export function stripInlineStyles(html: string): string {
  return html.replace(/ style="([^"]*)"/g, (match, styles: string) => {
    // Allow slide-bg-glow positioning and background styles
    if (/position\s*:\s*(absolute|relative)/.test(styles) && /background/.test(styles)) return match;
    // Allow legend-dot colors
    if (/background-color\s*:/.test(styles) && styles.length < 40) return match;
    // Allow bar-fill percentage
    if (/--fill-pct/.test(styles)) return match;
    // Allow SVG stroke attributes
    if (/stroke-dash/.test(styles)) return match;
    // Strip everything else
    return "";
  });
}

/**
 * Run the full legacy post-processing pipeline on raw HTML output.
 */
export function postProcessLegacyHTML(html: string): string {
  const publicDir = join(process.cwd(), "public");
  const cssPath = join(publicDir, "styles", "presentation.css");
  const jsPath = join(publicDir, "js", "presentation.js");

  html = stripEmbeddedStyles(html);
  html = stripInlineStyles(html);
  html = injectCSS(html, cssPath);
  html = injectJS(html, jsPath);
  html = enhanceAnimations(html);
  html = addBackgroundVariants(html);
  html = recoverTruncation(html);

  return html;
}
