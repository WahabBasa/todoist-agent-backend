import { memo, useMemo } from 'react';
import { marked } from 'marked';
import { Response } from '@/components/ai-elements/response';

/**
 * Parse markdown into blocks using marked's lexer
 * Each block represents a complete markdown unit (paragraph, heading, code block, etc.)
 */
function parseMarkdownIntoBlocks(markdown: string): string[] {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  try {
    const tokens = marked.lexer(markdown);
    return tokens.map((token) => token.raw);
  } catch (error) {
    console.error('Markdown parsing error:', error);
    // Fallback: return entire string as single block
    return [markdown];
  }
}

/**
 * Memoized individual markdown block
 * Only re-renders if the block content changes
 */
const MemoizedMarkdownBlock = memo(
  ({ content, className }: { content: string; className?: string }) => {
    return (
      <Response 
        className={className}
        parseIncompleteMarkdown={false}
      >
        {content}
      </Response>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if content actually changed
    return prevProps.content === nextProps.content && prevProps.className === nextProps.className;
  }
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

/**
 * Main memoized markdown component
 * Parses content into blocks and renders each as a memoized component
 * This prevents re-rendering of already-rendered blocks during streaming
 */
export const MemoizedMarkdown = memo(
  ({ 
    content, 
    id, 
    className 
  }: { 
    content: string; 
    id: string; 
    className?: string;
  }) => {
    // Parse into blocks only when content changes
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return (
      <>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock
            key={`${id}-block-${index}`}
            content={block}
            className={className}
          />
        ))}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if content or className changed
    return prevProps.content === nextProps.content && prevProps.className === nextProps.className;
  }
);

MemoizedMarkdown.displayName = 'MemoizedMarkdown';
