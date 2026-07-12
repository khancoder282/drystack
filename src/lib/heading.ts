export interface HeadingLine {
  before: string;
  emphasis: string | null;
  after: string;
}

export function parseHeadingLine(line: string): HeadingLine {
  const match = line.match(/^([\s\S]*?)\[([\s\S]+?)\]([\s\S]*)$/);
  if (!match) return { before: line, emphasis: null, after: "" };
  return { before: match[1], emphasis: match[2], after: match[3] };
}
