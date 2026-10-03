#!/usr/bin/env node
// Parses guideline.md (the raw research/exam-bank export) into data/questions.json,
// merging in the authored hint files (data/hints-set{1..5}.json).
// Pure Node, no npm dependencies.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PART_NAMES = {
  1: 'Science Innovation & Design Thinking',
  2: 'Business Model Canvas (BMC) & Market Sizing',
  3: 'Intellectual Property & Patent Search',
  4: 'Business Strategy & Pitch Deck Presentation',
};

const PART_IDS = {
  1: 'design-thinking',
  2: 'bmc',
  3: 'ip-patent',
  4: 'pitch',
};

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // source has a few spots where a stray Chinese character leaked in
    // (translation-tool artifact) in place of the intended Thai word "represents"
    .replace(/代表/g, 'หมายถึง');
}

function stripCitations(s) {
  return s.replace(/(\[\d+\])+/g, '');
}

// Strip all markdown emphasis markers, leaving plain text.
function plain(s) {
  let out = decodeEntities(s);
  out = stripCitations(out);
  out = out.replace(/\\\*/g, ''); // protect escaped literal asterisks
  out = out.replace(/\*/g, ''); // drop all markdown emphasis markers
  out = out.replace(//g, '*'); // restore literal asterisks
  return out.replace(/\s+/g, ' ').trim();
}

// Convert markdown **bold** / *italic* to HTML, preserving escaped \* as literal.
function mdInline(s) {
  let out = decodeEntities(s);
  out = stripCitations(out);
  out = out.replace(/\\\*/g, '');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/\*/g, '');
  out = out.replace(//g, '*');
  return out.replace(/\s+/g, ' ').trim();
}

// Splits text like "EN text *(TH text)*<junk>" into { main: "EN text", inner: "TH text" }.
// Uses last "*(" / last ")" rather than a strict regex, so it tolerates messy trailing
// markdown artifacts (stray "*", "\*") that appear in a few source entries.
function splitTrailingItalicParen(line) {
  const openIdx = line.lastIndexOf('*(');
  if (openIdx === -1) return { main: line, inner: '' };
  const afterOpen = line.slice(openIdx + 2);
  const closeIdx = afterOpen.lastIndexOf(')');
  if (closeIdx === -1) return { main: line, inner: '' };
  return { main: line.slice(0, openIdx), inner: afterOpen.slice(0, closeIdx) };
}

function parseQuestionBlock(piece, setNum, localIndex) {
  const lines = piece.split('\n');
  const headerLine = lines[0];

  const idMatch = headerLine.match(/Q(\d+)/);
  if (!idMatch) throw new Error(`Cannot find question id in header: ${headerLine}`);
  const id = Number(idMatch[1]);

  // question English text: strip leading #### and the "Qn\." marker, then all markdown
  let qEnRaw = headerLine.replace(/^#+\s*/, '');
  qEnRaw = qEnRaw.replace(/Q\d+\\?\.\s*/, '');
  const questionEn = plain(qEnRaw).replace(/\*+$/, '').trim();

  const firstOptionIdx = piece.search(/^\*\s+A\)/m);
  if (firstOptionIdx === -1) throw new Error(`Q${id}: no options found`);
  const introText = piece.slice(0, firstOptionIdx);
  const { inner: thRaw } = splitTrailingItalicParen(introText);
  const questionTh = plain(thRaw).replace(/\*+$/, '').trim();

  const afterOptions = piece.slice(firstOptionIdx);
  const ansIdx = afterOptions.search(/^&gt;.*เฉลย/m);
  const optionsText = ansIdx === -1 ? afterOptions : afterOptions.slice(0, ansIdx);

  const optionRe = /^\*\s+([A-D])\)\s*(.+?)\s*$/gm;
  const options = [];
  let m;
  while ((m = optionRe.exec(optionsText)) !== null) {
    const key = m[1];
    const rest = m[2];
    const { main: enRaw, inner: thRaw } = splitTrailingItalicParen(rest);
    const en = plain(enRaw).replace(/\*+$/, '').trim();
    const th = plain(thRaw).replace(/\*+$/, '').trim();
    options.push({ key, en, th });
  }
  if (options.length !== 4) {
    throw new Error(`Q${id}: expected 4 options, got ${options.length}`);
  }

  if (ansIdx === -1) throw new Error(`Q${id}: no เฉลย line found`);
  const ansText = afterOptions.slice(ansIdx);
  const afterLabel = ansText.slice(ansText.indexOf('เฉลย:') + 'เฉลย:'.length);
  const letterMatch = afterLabel.match(/([A-D])\)/);
  if (!letterMatch) throw new Error(`Q${id}: cannot find correct answer letter`);
  const correct = letterMatch[1];

  const expIdx = ansText.indexOf('คำอธิบาย:');
  if (expIdx === -1) throw new Error(`Q${id}: no คำอธิบาย marker found`);
  let explanationRaw = ansText.slice(expIdx + 'คำอธิบาย:'.length);
  // the label itself is bolded ("**คำอธิบาย:**"), so its closing marker is still
  // attached here - strip it before converting inline markdown, or it mispairs with
  // the first real bold term in the explanation.
  explanationRaw = explanationRaw.replace(/^\s*\*+/, ' ');
  // cut off at the block delimiter if present
  const dashIdx = explanationRaw.indexOf('\n---');
  if (dashIdx !== -1) explanationRaw = explanationRaw.slice(0, dashIdx);
  const explanation = mdInline(explanationRaw);

  const part = Math.floor((localIndex) / 10) + 1; // 0-based localIndex within set of 40

  return {
    id,
    set: setNum,
    part,
    partId: PART_IDS[part],
    partName: PART_NAMES[part],
    questionEn,
    questionTh,
    options,
    correct,
    explanation,
  };
}

function main() {
  const mdPath = path.join(ROOT, 'guideline.md');
  const raw = readFileSync(mdPath, 'utf8');

  const startIdx = raw.indexOf('แนวข้อสอบชุดที่ 1');
  if (startIdx === -1) throw new Error('Could not locate start of exam bank content');
  // back up to the start of that heading line
  const headingStart = raw.lastIndexOf('\n#', startIdx) + 1;
  const content = raw.slice(headingStart);

  const setChunks = content.split(/\n(?=# \*)/).filter((c) => /แนวข้อสอบชุดที่\s*\d+/.test(c));

  const questions = [];
  for (const chunk of setChunks) {
    const setMatch = chunk.match(/แนวข้อสอบชุดที่\s*(\d+)/);
    if (!setMatch) continue;
    const setNum = Number(setMatch[1]);

    const pieces = chunk.split(/\n(?=#### )/).slice(1); // drop intro/part-header text before first question
    pieces.forEach((piece, i) => {
      const q = parseQuestionBlock(piece, setNum, i);
      questions.push(q);
    });
  }

  if (questions.length !== 200) {
    throw new Error(`Expected 200 questions, parsed ${questions.length}`);
  }
  questions.sort((a, b) => a.id - b.id);
  questions.forEach((q, i) => {
    if (q.id !== i + 1) throw new Error(`Question id gap/order issue near id=${q.id}`);
  });

  // merge hints
  let hintsFound = 0;
  for (let setN = 1; setN <= 5; setN++) {
    const hp = path.join(ROOT, 'data', `hints-set${setN}.json`);
    if (!existsSync(hp)) {
      console.warn(`WARN: missing ${hp}, questions in set ${setN} will have empty hints`);
      continue;
    }
    const hints = JSON.parse(readFileSync(hp, 'utf8'));
    for (const q of questions) {
      if (q.set !== setN) continue;
      const h = hints[String(q.id)];
      if (h) {
        q.hint = h.trim();
        hintsFound++;
      }
    }
  }
  for (const q of questions) {
    if (!q.hint) q.hint = '';
  }

  const outPath = path.join(ROOT, 'data', 'questions.json');
  writeFileSync(outPath, JSON.stringify(questions, null, 2) + '\n', 'utf8');

  console.log(`Parsed ${questions.length} questions across ${setChunks.length} sets.`);
  console.log(`Hints merged: ${hintsFound}/${questions.length}`);
  const missingHints = questions.filter((q) => !q.hint).map((q) => q.id);
  if (missingHints.length) {
    console.warn(`Questions missing hints (${missingHints.length}): ${missingHints.join(', ')}`);
  }
  console.log(`Wrote ${outPath}`);
}

main();
