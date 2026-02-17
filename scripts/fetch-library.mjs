import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = JSON.parse(readFileSync(join(__dirname, 'library.config.json'), 'utf-8'));
const OUTPUT_DIR = join(__dirname, '..', 'src', 'data', 'library');
const TEMP_DIR = join(__dirname, '..', '.tmp-library');

function getAllFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      results.push(...getAllFiles(fullPath, base));
    } else if (/\.(md|rst|txt)$/i.test(entry)) {
      try {
        results.push({
          path: relative(base, fullPath),
          content: readFileSync(fullPath, 'utf-8'),
        });
      } catch {
        // Skip files that can't be read
      }
    }
  }
  return results;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSectionTree(files) {
  const mdFiles = files
    .filter(f => f.path.endsWith('.md') || f.path.endsWith('.rst'))
    .sort((a, b) => a.path.localeCompare(b.path));

  const root = [];
  const dirMap = new Map();

  for (const file of mdFiles) {
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];
    const title = fileName.replace(/\.(md|rst)$/, '').replace(/[-_]/g, ' ');

    const section = {
      id: slugify(file.path),
      title: title === 'README' ? (parts.length > 1 ? parts[parts.length - 2].replace(/[-_]/g, ' ') : 'Overview') : title,
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

function countSections(sections) {
  let count = 0;
  for (const s of sections) {
    count++;
    if (s.children) count += countSections(s.children);
  }
  return count;
}

function parseSudheerQA(content, tag) {
  const sections = [];
  const exercises = [];
  const questionRegex = /^\d+\.\s+###\s+(.+)$/gm;
  const matches = [...content.matchAll(questionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const questionTitle = matches[i][1].trim();
    const startIdx = matches[i].index + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const answerContent = content.slice(startIdx, endIdx)
      .replace(/\*\*\[.*?Back to Top.*?\]\(.*?\)\*\*/g, '')
      .trim();

    const id = `q-${i + 1}`;
    sections.push({
      id,
      title: `${i + 1}. ${questionTitle}`,
      content: `### ${questionTitle}\n\n${answerContent}`,
    });

    const firstParagraph = answerContent.split('\n\n')[0]?.replace(/^[\s-]+/, '').trim() || answerContent;
    exercises.push({
      id,
      type: 'qa',
      question: questionTitle,
      answer: firstParagraph.length > 500 ? firstParagraph.slice(0, 500) + '...' : firstParagraph,
      tags: [tag],
    });
  }

  return { sections, exercises, totalItems: sections.length + exercises.length };
}

function parseDevopsExercises(files) {
  const sections = [];
  const exercises = [];
  const topicFiles = files.filter(f => f.path.startsWith('topics/') && f.path.endsWith('.md'));

  for (const file of topicFiles) {
    const parts = file.path.split('/');
    const topicName = parts[1] || 'general';

    const detailsRegex = /<details>\s*<summary>([\s\S]*?)<\/summary>[\s\S]*?<b>\s*([\s\S]*?)\s*<\/b>\s*<\/details>/gi;
    const matches = [...file.content.matchAll(detailsRegex)];

    if (matches.length > 0) {
      sections.push({
        id: `devops-${topicName}`,
        title: topicName.replace(/[-_]/g, ' '),
        content: file.content,
      });

      for (let i = 0; i < matches.length; i++) {
        const question = matches[i][1].replace(/<[^>]*>/g, '').trim();
        const answer = matches[i][2].replace(/<[^>]*>/g, '').trim();
        if (question && answer) {
          exercises.push({
            id: `devops-${topicName}-${i}`,
            type: 'qa',
            question,
            answer: answer.length > 500 ? answer.slice(0, 500) + '...' : answer,
            tags: ['devops', topicName],
          });
        }
      }
    }
  }

  // Also include non-topic files as sections using base adapter logic
  const otherFiles = files.filter(f => !f.path.startsWith('topics/') && (f.path.endsWith('.md') || f.path.endsWith('.rst')));
  for (const file of otherFiles) {
    const title = file.path.replace(/\.(md|rst)$/, '').replace(/[-_]/g, ' ').split('/').pop() || 'Overview';
    sections.unshift({
      id: slugify(file.path),
      title,
      content: file.content,
    });
  }

  return { sections, exercises, totalItems: sections.length + exercises.length };
}

async function main() {
  console.log(`Fetching ${config.repos.length} repos...\n`);

  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const manifest = { repos: [], generatedAt: new Date().toISOString() };

  for (const repo of config.repos) {
    const repoDir = join(TEMP_DIR, repo.id);
    console.log(`Cloning ${repo.source}...`);

    try {
      execSync(`git clone --depth=1 "${repo.source}" "${repoDir}"`, {
        stdio: 'pipe',
        timeout: 120000,
      });

      const files = getAllFiles(repoDir);
      console.log(`  Found ${files.length} content files`);

      let parsed;
      if (repo.adapter === 'javascript-questions' || repo.adapter === 'react-questions') {
        const readme = files.find(f => f.path === 'README.md');
        const tag = repo.adapter === 'javascript-questions' ? 'javascript' : 'react';
        parsed = readme ? parseSudheerQA(readme.content, tag) : { sections: [], exercises: [], totalItems: 0 };
      } else if (repo.adapter === 'devops-exercises') {
        parsed = parseDevopsExercises(files);
      } else {
        // existing base adapter logic
        const sections = buildSectionTree(files);
        parsed = { sections, exercises: [], totalItems: countSections(sections) };
      }

      const repoOutputDir = join(OUTPUT_DIR, repo.id);
      mkdirSync(repoOutputDir, { recursive: true });
      writeFileSync(join(repoOutputDir, 'content.json'), JSON.stringify(parsed));

      manifest.repos.push({
        id: repo.id,
        name: repo.name,
        source: repo.source,
        description: repo.description,
        tags: repo.tags,
        icon: repo.icon,
        sectionCount: parsed.sections.length,
        exerciseCount: parsed.exercises.length,
        lastFetched: new Date().toISOString(),
      });

      console.log(`  -> ${parsed.sections.length} sections, ${parsed.exercises.length} exercises\n`);
    } catch (err) {
      console.error(`  ERROR cloning ${repo.id}: ${err.message}\n`);
    }
  }

  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written with ${manifest.repos.length} repos.`);

  rmSync(TEMP_DIR, { recursive: true });
  console.log('Temp directory cleaned up.');
}

main().catch(console.error);
