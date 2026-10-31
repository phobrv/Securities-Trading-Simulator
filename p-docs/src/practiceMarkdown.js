import DOMPurify from "dompurify";
import { marked } from "marked";

// Keep the allowed HTML small: question content is data, not trusted markup.
export function renderPracticeMarkdown(source) {
  const html = marked.parse(source, { gfm: true, breaks: true, async: false });
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "code",
      "pre",
      "blockquote",
      "a",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ],
    ALLOWED_ATTR: ["href", "title"],
  });
}
