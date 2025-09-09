export function processJsDocLinks(text: string): string {
  if (!text) return '';
  
  const linkRegex = /\{@link\s+([^\}]+)\}/g;
  return text.replace(linkRegex, (match, linkContent) => {
    const [url, ...textParts] = linkContent.split(/\s+/);
    const linkText = textParts.join(' ') || url;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    }
    
    return `<a href="#${url}">${linkText}</a>`;
  });
}

export function parseMarkdown(text: string): string {
  if (!text) return '';
  
  let processed = processJsDocLinks(text);
  
  processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  processed = processed.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  
  processed = processed.replace(/\n\n/g, '</p><p>');
  processed = `<p>${processed}</p>`;
  
  processed = processed.replace(/^```(\w+)?\n([\s\S]*?)```$/gm, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'plaintext'}">${code}</code></pre>`;
  });
  
  return processed;
}