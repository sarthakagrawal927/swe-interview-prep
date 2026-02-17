import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import type { Section } from '../adapters/types';

interface SectionTreeProps {
  sections: Section[];
  activeSectionId: string | null;
  onSelect: (section: Section) => void;
}

function containsActiveId(section: Section, activeId: string | null): boolean {
  if (!activeId) return false;
  if (section.id === activeId) return true;
  return section.children?.some(c => containsActiveId(c, activeId)) ?? false;
}

function SectionNode({
  section,
  depth,
  activeSectionId,
  onSelect,
}: {
  section: Section;
  depth: number;
  activeSectionId: string | null;
  onSelect: (section: Section) => void;
}) {
  const hasChildren = section.children && section.children.length > 0;
  const isActive = section.id === activeSectionId;
  const [expanded, setExpanded] = useState(
    depth < 1 || containsActiveId(section, activeSectionId)
  );

  // Auto-expand when active section changes to be within this node
  useEffect(() => {
    if (hasChildren && containsActiveId(section, activeSectionId)) {
      setExpanded(true);
    }
  }, [activeSectionId, hasChildren, section]);

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          if (section.content) onSelect(section);
        }}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-emerald-500/15 text-emerald-400 font-medium'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          )
        ) : (
          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="truncate">{section.title}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {section.children!.map((child, i) => (
            <SectionNode
              key={`${child.id}-${i}`}
              section={child}
              depth={depth + 1}
              activeSectionId={activeSectionId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SectionTree({ sections, activeSectionId, onSelect }: SectionTreeProps) {
  return (
    <nav className="space-y-0.5 overflow-y-auto">
      {sections.map((section, i) => (
        <SectionNode
          key={`${section.id}-${i}`}
          section={section}
          depth={0}
          activeSectionId={activeSectionId}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}
