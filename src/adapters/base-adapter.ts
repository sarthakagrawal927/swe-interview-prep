import type { RepoFile, RepoAdapter, ParsedRepo, Section } from './types';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSectionTree(files: RepoFile[]): Section[] {
  const mdFiles = files
    .filter(f => f.path.endsWith('.md') || f.path.endsWith('.rst'))
    .sort((a, b) => a.path.localeCompare(b.path));

  const root: Section[] = [];
  const dirMap = new Map<string, Section>();

  for (const file of mdFiles) {
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];
    const title = fileName.replace(/\.(md|rst)$/, '').replace(/[-_]/g, ' ');

    const section: Section = {
      id: slugify(file.path),
      title: title === 'README' ? (parts.length > 1 ? parts[parts.length - 2] : 'Overview') : title,
      content: file.content,
    };

    if (parts.length === 1) {
      root.push(section);
    } else {
      const dirPath = parts.slice(0, -1).join('/');
      let parent = dirMap.get(dirPath);
      if (!parent) {
        parent = {
          id: slugify(dirPath),
          title: parts[parts.length - 2].replace(/[-_]/g, ' '),
          content: '',
          children: [],
        };
        dirMap.set(dirPath, parent);
        const grandparentPath = parts.slice(0, -2).join('/');
        const grandparent = dirMap.get(grandparentPath);
        if (grandparent) {
          grandparent.children = grandparent.children || [];
          grandparent.children.push(parent);
        } else {
          root.push(parent);
        }
      }
      parent.children = parent.children || [];
      parent.children.push(section);
    }
  }

  return root;
}

export function createBaseAdapter(config: {
  id: string;
  name: string;
  source: string;
  description: string;
  tags: string[];
  icon: string;
}): RepoAdapter {
  return {
    ...config,
    parseContent(files: RepoFile[]): ParsedRepo {
      const sections = buildSectionTree(files);
      return {
        sections,
        exercises: [],
        totalItems: sections.length,
      };
    },
  };
}
