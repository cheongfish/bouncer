'use strict';

const fs = require('node:fs');
const path = require('node:path');

// HTML 주석의 backtick만 치환하는 내부 표식이다. 주석을 통째로 비우면 code span의
// 닫힘 표식까지 사라져 뒤의 실제 링크가 코드로 오인된다. 표식은 fence 규칙에는
// backtick이 아니어서 주석 속 ```가 보이는 fence가 되는 부작용도 막는다.
const COMMENT_BACKTICK = '\uE000';

/**
 * Markdown 계약에서 문구가 아니라 위치·형태로 재사용할 수 있는 정보만 추출한다.
 * 정규식은 Markdown의 경계를 찾는 데만 쓰고, 계약 문장 자체를 정본으로 복제하지 않는다.
 *
 * @param {string} markdown - 검사할 Markdown 원문
 * @returns {{frontmatter: object, headings: Array<object>, links: Array<object>, steps: Array<object>}}
 */
function extractDocShape(markdown) {
  const source = stripHtmlComments(markdown);
  const lines = source.split(/\r?\n/);
  const frontmatter = extractFrontmatter(lines);
  const headings = [];
  const links = [];
  const steps = [];
  let fence = null;
  let inlineCodeDelimiter = null;

  for (let index = 0; index < lines.length; index += 1) {
    // YAML frontmatter는 Markdown 본문이 아니므로 그 안의 위조 H2·링크가 계약을
    // 만족시키지 못하게 본문 추출 전에 제외한다.
    if (frontmatter.present && index < frontmatter.endLine) continue;
    const line = lines[index];
    const fenceResult = fenceTransition(line, fence);
    if (fenceResult.consumed) {
      fence = fenceResult.fence;
      continue;
    }
    if (fence) continue;

    // 코드 span은 줄을 넘어도 하나의 인라인 토큰이다. 링크만 뒤늦게 지우면 중간 줄의
    // `##`·`1.`이 실제 문서 구조로 승격되어 계약 누락을 가리는 거짓 통과가 된다.
    const inlineCode = stripInlineCode(line, inlineCodeDelimiter);
    inlineCodeDelimiter = inlineCode.delimiter;
    const visibleLine = inlineCode.text;

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(visibleLine);
    if (heading) {
      headings.push({ level: heading[1].length, text: heading[2].trim(), line: index + 1, index });
    }

    const step = /^(\d+)\.\s+(?:\*\*(.+?)\*\*|(.+?))\s*$/.exec(visibleLine);
    if (step) {
      steps.push({ number: Number(step[1]), title: (step[2] || step[3]).trim(), line: index + 1, index });
    }

    // 인라인 코드 안의 모양은 Markdown 링크가 아니므로 링크 토큰화 전에 제거한다.
    // 줄을 넘는 code span도 상태를 이어 받아 ``...`` 안의 링크가 노출되지 않게 한다.
    const linkSource = stripImageLinks(visibleLine);
    const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g;
    let match;
    while ((match = linkPattern.exec(linkSource)) !== null) {
      // 이미지는 시각 자료이지 문서 참조가 아니므로, 같은 대상 파일을 가리켜도
      // 필수 링크 계약의 대체물로 세지 않는다.
      if (!match[0].startsWith('!')) links.push({ href: match[1], line: index + 1 });
    }
  }

  return {
    source,
    frontmatter,
    headings,
    links,
    steps: steps.map((step, position) => {
      // 절차 단계는 다음 번호만이 아니라 다음 H2에서 끝난다. ACQ 색인은 별도 H2라서,
      // 그 안의 라벨을 앞 단계의 승인 질문으로 세면 이동·누락을 숨기는 거짓 통과가 된다.
      const nextStepIndex = steps[position + 1]?.index ?? lines.length;
      const nextH2Index = headings.find((heading) => heading.level === 2 && heading.index > step.index)?.index;
      const endIndex = Math.min(nextStepIndex, nextH2Index ?? lines.length);
      return {
        ...step,
        endLine: endIndex,
        body: lines.slice(step.index, endIndex).join('\n'),
      };
    }),
  };
}

/**
 * Markdown 시작부의 YAML frontmatter 경계를 찾아 top-level 필드를 읽는다.
 * 닫는 구분자가 없으면 frontmatter가 없는 것으로 반환해 본문 위조가 계약을
 * 만족시키지 못하도록 한다.
 *
 * @param {string[]} lines - 줄바꿈으로 나눈 Markdown
 * @returns {{present: boolean, fields: object, endLine: number|null}} 파싱 결과
 */
function extractFrontmatter(lines) {
  if (lines[0] !== '---') return { present: false, fields: {}, endLine: null };
  const fields = {};
  let endLine = null;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      endLine = index + 1;
      break;
    }
    // 중첩 YAML의 값까지 해석할 필요 없이, 계약에 쓰는 top-level 필드만 보존한다.
    const field = /^([A-Za-z][\w-]*):(?:\s*(.*))?$/.exec(lines[index]);
    if (field) fields[field[1]] = scalarValue(field[2] || '');
  }
  return { present: endLine !== null, fields, endLine };
}

/**
 * frontmatter 계약에 필요한 단순 YAML scalar만 변환한다.
 * 전체 YAML 파서는 범위를 넓히고 의존성을 추가하므로, 이 도우미는 구조 계약에
 * 쓰이는 top-level 값만 보존한다.
 *
 * @param {string} value - scalar 원문
 * @returns {string|boolean|number|null} 비교 가능한 scalar 값
 */
function scalarValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  // Plain scalar의 공백 뒤 #은 YAML 주석이다. 이를 값으로 세면 설명 없이
  // 안내 주석만 둔 frontmatter가 nonEmpty 계약을 통과한다.
  const plainValue = (trimmed.startsWith('#') ? '' : trimmed.replace(/\s+#.*$/, '')).trim();
  if (plainValue === 'true' || plainValue === 'false') return plainValue === 'true';
  if (plainValue === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(plainValue)) return Number(plainValue);
  return plainValue;
}

/**
 * HTML 주석을 보이는 Markdown 구조에서 제외하되, fenced code 안의 예시는 그대로
 * 남긴다. 주석의 줄바꿈과 inline-code delimiter 표식은 보존해 heading·단계의 실제
 * 위치와 code span 경계가 변하지 않도록 하며, 여러 줄 주석의 앞뒤 실제 구조는
 * 계속 추출할 수 있다.
 *
 * @param {string} markdown - 검사할 Markdown 원문
 * @returns {string} HTML 주석만 비운 Markdown 원문
 */
function stripHtmlComments(markdown) {
  let commentOpen = false;
  let fence = null;
  let inlineCodeDelimiter = null;

  return markdown.split(/\r?\n/).map((line) => {
    // 코드 예시는 HTML이 아니라 코드 자체이므로 주석처럼 지우면 fence 안의 경계와
    // 문서 예시가 달라진다. 열린 fence는 원문으로 닫힘만 추적한다.
    if (fence) {
      const transition = fenceTransition(line, fence);
      fence = transition.fence;
      return line;
    }

    let visible = '';
    let cursor = 0;
    while (cursor < line.length) {
      if (commentOpen) {
        const close = line.indexOf('-->', cursor);
        // 주석 앞의 실제 Markdown이 이미 code span을 열었을 때만 주석 속
        // backtick을 닫힘 후보로 남긴다. 독립 주석의 ```까지 보존하면 이후
        // 추출기가 가짜 inline span을 열어 실제 링크를 가릴 수 있다.
        const preserveDelimiter = stripInlineCode(visible, inlineCodeDelimiter).delimiter !== null;
        if (close === -1) {
          visible += preserveDelimiter ? commentBackticks(line.slice(cursor)) : '';
          inlineCodeDelimiter = stripInlineCode(visible, inlineCodeDelimiter).delimiter;
          return visible;
        }
        visible += preserveDelimiter ? commentBackticks(line.slice(cursor, close)) : '';
        commentOpen = false;
        cursor = close + 3;
        continue;
      }
      const open = line.indexOf('<!--', cursor);
      if (open === -1) {
        visible += line.slice(cursor);
        break;
      }
      visible += line.slice(cursor, open);
      commentOpen = true;
      cursor = open + 4;
    }

    const transition = fenceTransition(visible, null);
    fence = transition.fence;
    inlineCodeDelimiter = stripInlineCode(visible, inlineCodeDelimiter).delimiter;
    return visible;
  }).join('\n');
}

/**
 * 주석 내부의 backtick run만 inline-code 추적용 내부 표식으로 남긴다.
 * 다른 문자는 모두 버려 comment-only 구조가 보이는 Markdown으로 승격되지 않으며,
 * 표식은 fenceTransition이 인식하지 않아 주석 예시가 fence 경계를 바꾸지 못한다.
 *
 * @param {string} comment - 제거할 HTML 주석 조각
 * @returns {string} code span 경계만 보존한 내부 표식 문자열
 */
function commentBackticks(comment) {
  return comment.replace(/[^`]/g, '').replace(/`/g, COMMENT_BACKTICK);
}

/**
 * 이미지가 중첩된 링크는 문서 참조 계약의 대상이 아니다.
 * 단순 정규식으로는 바깥 [ 가 일반 링크처럼 시작되어 안쪽 이미지의 href를
 * 계약 링크로 잘못 셀 수 있으므로, 토큰화 전에 이 중첩 형태 전체를 제외한다.
 *
 * @param {string} text - 인라인 코드를 제거한 한 줄
 * @returns {string} 참조 링크를 찾을 수 있는 텍스트
 */
function stripImageLinks(text) {
  return text.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '');
}

/**
 * 문서의 구조 계약만 검사하고, 계약 문구 자체를 정본으로 복제하지 않는다.
 * 누락·순서 오류·깨진 참조는 errors에 누적해 호출자가 한 번에 확인할 수 있다.
 *
 * @param {string} markdown - 검사할 Markdown 원문
 * @param {object} contract - frontmatter, heading, link, step 계약
 * @returns {{ok: boolean, errors: string[], shape: object}} 통과 여부와 추출된 구조
 */
function checkDocShape(markdown, contract = {}) {
  const shape = extractDocShape(markdown);
  const errors = [];
  const frontmatter = contract.frontmatter || {};

  const hasFrontmatterContract = (frontmatter.required && frontmatter.required.length > 0)
    || Object.keys(frontmatter.values || {}).length > 0;
  if (hasFrontmatterContract && !shape.frontmatter.present) {
    errors.push('missing frontmatter');
  }
  for (const field of frontmatter.required || []) {
    if (!Object.prototype.hasOwnProperty.call(shape.frontmatter.fields, field)) {
      errors.push(`missing frontmatter field: ${field}`);
    }
  }
  for (const field of frontmatter.nonEmpty || []) {
    const hasField = Object.prototype.hasOwnProperty.call(shape.frontmatter.fields, field);
    if (!hasField) {
      if (!(frontmatter.required || []).includes(field)) errors.push(`missing frontmatter field: ${field}`);
    } else if (typeof shape.frontmatter.fields[field] !== 'string'
      || shape.frontmatter.fields[field].trim().length === 0) {
      errors.push(`empty frontmatter field: ${field}`);
    }
  }
  for (const [field, expected] of Object.entries(frontmatter.values || {})) {
    if (shape.frontmatter.fields[field] !== expected) {
      errors.push(`frontmatter field ${field} does not equal ${String(expected)}`);
    }
  }

  const h2 = shape.headings.filter((heading) => heading.level === 2);
  const h2Titles = h2.map((heading) => heading.text);
  for (const title of (contract.headings?.required || [])) {
    if (!h2Titles.includes(title)) errors.push(`missing H2: ${title}`);
  }
  checkOrder(contract.headings?.order || [], h2Titles, 'H2', errors);

  for (const expected of contract.links || []) {
    const matches = shape.links.filter((link) => link.href === expected.href);
    if (matches.length === 0) {
      errors.push(`missing Markdown link: ${expected.href}`);
      continue;
    }
    if (expected.resolve) {
      if (!contract.filePath) {
        errors.push(`cannot resolve link without filePath: ${expected.href}`);
      } else if (!linkExists(
        expected.href,
        contract.filePath,
        expected.referencePreamble,
        shape.source,
        conditionalLoadTriggers(expected.conditionalLoad),
      )) {
        errors.push(`broken Markdown link: ${expected.href}`);
      }
      if (expected.conditionalLoad && !hasConditionalLinkLoad(
        matches,
        shape.source,
        conditionalLoadTriggers(expected.conditionalLoad),
      )) {
        errors.push(`link does not conditionally load reference with required semantic trigger: ${expected.href}`);
      }
    }
  }

  const stepNumbers = shape.steps.map((step) => step.number);
  for (const number of contract.steps?.required || []) {
    if (!stepNumbers.includes(number)) errors.push(`missing numbered step: ${number}`);
  }
  if (contract.steps?.order) checkOrder(contract.steps.required || [], stepNumbers, 'step', errors);
  for (const number of contract.steps?.acq || []) {
    const step = shape.steps.find((candidate) => candidate.number === number);
    if (!step || !hasAcqLabel(step.body)) {
      errors.push(`step ${number} is missing an ACQ block`);
    }
  }
  for (const number of contract.steps?.acqOptions || []) {
    const step = shape.steps.find((candidate) => candidate.number === number);
    if (!step || !/\*\*Options\*\*:/m.test(stripFencedCode(step.body))) {
      errors.push(`step ${number} is missing an Options block`);
    }
  }
  for (const [number, hrefs] of Object.entries(contract.steps?.links || {})) {
    const step = shape.steps.find((candidate) => candidate.number === Number(number));
    for (const href of hrefs) {
      if (!step || !stepHasLink(step, href)) {
        errors.push(`step ${number} is missing Markdown link: ${href}`);
      }
    }
  }
  if (contract.steps?.noAcq
    && shape.steps.some((step) => hasAcqLabel(step.body))) {
    errors.push('numbered steps unexpectedly contain an ACQ block');
  }

  const indexContract = contract.acqIndex;
  if (indexContract) {
    const indexHeading = h2.find((heading) => heading.text === indexContract.heading);
    if (!indexHeading) {
      errors.push(`missing ACQ index H2: ${indexContract.heading}`);
    } else {
      const nextHeading = h2.find((heading) => heading.line > indexHeading.line);
      const body = shape.source.split(/\r?\n/)
        .slice(indexHeading.line, nextHeading ? nextHeading.line - 1 : undefined).join('\n');
      const visibleBody = stripFencedCode(body);
      const indexedSteps = [];
      for (const line of visibleBody.split(/\r?\n/)) {
        const match = /^\s*-\s*[Ss]tep\s+(\d+)\b/.exec(line);
        if (match) indexedSteps.push(Number(match[1]));
      }
      if (JSON.stringify(indexedSteps) !== JSON.stringify(indexContract.steps || [])) {
        errors.push(`ACQ index steps are not ${indexContract.steps?.join(', ')}`);
      }
      if (indexContract.only && (
        hasAcqLabel(visibleBody)
        || /\*\*Options\*\*:/m.test(visibleBody)
        || /\*\*[^*\n]*\bAskUserQuestion\b[^*\n]*\*\*/im.test(visibleBody)
      )) {
        errors.push('ACQ index contains inline question content');
      }
    }
  }

  return { ok: errors.length === 0, errors, shape };
}

/**
 * 여러 줄에 걸친 Markdown inline code를 링크 추출 대상에서 제거한다.
 * 닫는 backtick run의 길이가 열림과 다르면 code span을 닫지 않는 Markdown
 * 규칙을 따라, 다음 줄까지 delimiter 상태를 보존한다.
 *
 * @param {string} line - 처리할 Markdown 한 줄
 * @param {number|null} activeDelimiter - 이전 줄에서 열린 backtick 길이
 * @returns {{text: string, delimiter: number|null}} 보이는 텍스트와 다음 상태
 */
function stripInlineCode(line, activeDelimiter = null) {
  const visible = [];
  let delimiter = activeDelimiter;
  let cursor = 0;

  while (cursor < line.length) {
    const start = inlineDelimiterStart(line, cursor);
    if (start === -1) {
      if (delimiter === null) visible.push(line.slice(cursor));
      break;
    }

    let end = start;
    while (isInlineDelimiter(line[end])) end += 1;
    const length = end - start;

    if (delimiter !== null) {
      if (length === delimiter) delimiter = null;
      cursor = end;
      continue;
    }

    visible.push(line.slice(cursor, start));
    delimiter = length;
    cursor = end;
    while (cursor < line.length) {
      const closingStart = inlineDelimiterStart(line, cursor);
      if (closingStart === -1) break;
      let closingEnd = closingStart;
      while (isInlineDelimiter(line[closingEnd])) closingEnd += 1;
      if (closingEnd - closingStart === delimiter) {
        delimiter = null;
        cursor = closingEnd;
        break;
      }
      cursor = closingEnd;
    }
  }

  return { text: visible.join(''), delimiter };
}

/**
 * 실제 backtick과 주석에서 보존한 내부 표식 모두를 inline-code 경계로 찾는다.
 * 이 단계에서만 표식을 backtick처럼 취급해야 comment 안의 닫힘을 잃지 않으면서도
 * 앞선 fence 판정은 주석 구조를 계속 무시할 수 있다.
 *
 * @param {string} line - 처리 중인 Markdown 한 줄
 * @param {number} cursor - 검색 시작 위치
 * @returns {number} 다음 delimiter 위치. 없으면 -1
 */
function inlineDelimiterStart(line, cursor) {
  for (let index = cursor; index < line.length; index += 1) {
    if (isInlineDelimiter(line[index])) return index;
  }
  return -1;
}

/**
 * inline code 추적에서만 유효한 delimiter 문자인지 판정한다.
 *
 * @param {string|undefined} character - 검사할 한 글자
 * @returns {boolean} backtick 또는 주석 보존 표식이면 true
 */
function isInlineDelimiter(character) {
  return character === '`' || character === COMMENT_BACKTICK;
}

/**
 * fenced code를 제거한 단계 본문에서 ACQ 라벨의 구조적 표식을 찾는다.
 * 예시 코드가 실제 질문 게이트로 승격되는 것을 막고, 굵은 라벨만 계약으로
 * 인정해 산문의 임의 단어가 우연히 통과하지 않게 한다.
 *
 * @param {string} body - 단계 또는 인덱스 본문
 * @returns {boolean} 보이는 ACQ 라벨이 있으면 true
 */
function hasAcqLabel(body) {
  const visibleBody = stripFencedCode(body);
  return /\*\*(?![^*\n]*\bno\s+ACQ\b)[^*\n]*\bACQ\b[^*\n]*\*\*|\*\*[^*\n]*AskUserQuestion\s*[—:-][^*\n]*\*\*/im.test(visibleBody);
}

/**
 * Markdown fenced code의 열림·닫힘을 CommonMark의 길이 규칙으로 추적한다.
 * 짧은 내부 fence가 긴 외부 fence를 닫지 못하게 해야 ACQ 예시가 실제 계약으로
 * 승격되지 않으며, backtick과 tilde를 같은 경계 규칙으로 다룰 수 있다.
 *
 * @param {string} line - 판정할 Markdown 한 줄
 * @param {{char: string, length: number}|null} activeFence - 현재 열린 fence
 * @returns {{fence: {char: string, length: number}|null, consumed: boolean}} 새 상태와 소비 여부
 */
function fenceTransition(line, activeFence) {
  if (activeFence) {
    const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
    if (closing) {
      const marker = closing[1];
      if (marker[0] === activeFence.char && marker.length >= activeFence.length) {
        return { fence: null, consumed: true };
      }
    }
    return { fence: activeFence, consumed: true };
  }

  const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!opening) return { fence: null, consumed: false };
  const marker = opening[1];
  // backtick info string 안의 backtick은 유효한 Markdown fence가 아니므로,
  // 이를 경계로 인정하면 일반 인라인 코드를 문서 전체 차단 상태로 오인한다.
  if (marker[0] === '`' && opening[2].includes('`')) {
    return { fence: null, consumed: false };
  }
  return { fence: { char: marker[0], length: marker.length }, consumed: true };
}

/**
 * 기대한 항목이 실제 추출 순서에서 앞뒤 관계를 유지하는지 검사한다.
 * 항목 누락은 호출자가 별도 계약으로 보고하므로 여기서는 존재하는 항목의
 * 순서만 판정한다.
 *
 * @param {string[]|number[]} expected - 유지해야 하는 순서
 * @param {number[]|string[]} actual - 문서에서 추출한 순서
 * @param {string} label - 오류 메시지용 구조 이름
 * @param {string[]} errors - 오류를 누적할 배열
 * @returns {void} errors 배열을 제자리에서 갱신
 */
function checkOrder(expected, actual, label, errors) {
  let previous = -1;
  for (const item of expected) {
    const position = actual.indexOf(item);
    if (position === -1) continue;
    if (position <= previous) errors.push(`${label} order is broken at ${String(item)}`);
    previous = position;
  }
}

/**
 * 상대 경로·fragment 링크를 실제 파일과 heading slug에 대조한다.
 * 외부 URL과 런타임 치환 경로는 이 저장소의 정적 검사 범위 밖이므로 존재하는
 * 것으로 취급하고, 로컬 링크만 파일 시스템에서 확인한다.
 *
 * @param {string} href - Markdown 링크 대상
 * @param {string} filePath - 링크를 포함한 문서의 절대 경로
 * @param {boolean} referencePreamble - 대상 reference의 선두 계약도 확인할지 여부
 * @param {string} source - filePath가 가리키는 문서 원문
 * @param {string[]} triggers - 조건부 로딩이 보존해야 하는 route 의미 단위
 * @returns {boolean} 링크 대상과 fragment가 유효하면 true
 */
function linkExists(href, filePath, referencePreamble = false, source = '', triggers = []) {
  if (href.startsWith('http://') || href.startsWith('https://') || href.includes('${')) return true;
  const hash = href.indexOf('#');
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? '' : href.slice(hash + 1);
  const targetPath = rawPath ? path.resolve(path.dirname(filePath), rawPath) : filePath;
  if (rawPath && !fs.existsSync(targetPath)) return false;

  let target;
  try {
    target = rawPath ? fs.readFileSync(targetPath, 'utf8') : source;
  } catch {
    return false;
  }
  if (referencePreamble && !hasReferencePreamble(target, triggers)) return false;
  if (!fragment) return true;
  const headings = extractDocShape(target).headings;
  let decodedFragment;
  try {
    decodedFragment = decodeURIComponent(fragment);
  } catch {
    return false;
  }
  return headings.some((heading) => headingSlug(heading.text) === decodedFragment);
}

/**
 * 참조 링크가 조건부로 읽도록 지시된 위치에 있는지 확인한다.
 * 링크 존재만으로는 독자가 언제 해당 문서를 읽어야 하는지 알 수 없다. 조건과
 * 로딩 동사를 분리해 판정하면 특정 안내 문장을 정본으로 복제하지 않고도 그
 * 실행 계약을 유지할 수 있다.
 *
 * @param {Array<object>} matches - 같은 href로 추출된 보이는 Markdown 링크
 * @param {string} markdown - 링크를 포함한 원문
 * @param {string[]} triggers - 조건부 로딩이 보존해야 하는 route 의미 단위
 * @returns {boolean} 조건과 로딩 행동을 함께 가진 링크 행이 있으면 true
 */
function hasConditionalLinkLoad(matches, markdown, triggers = []) {
  const lines = markdown.split(/\r?\n/);
  return matches.some((match) => {
    const linkIndex = match.line - 1;
    let start = linkIndex;
    let end = linkIndex + 1;
    while (start > 0 && lines[start - 1].trim() !== '') start -= 1;
    while (end < lines.length && lines[end].trim() !== '') end += 1;
    return isConditionalLoadInstruction(lines.slice(start, end).join(' '), triggers);
  });
}

/**
 * 단계 본문에 지정된 일반 Markdown 링크가 실제로 포함되는지 확인한다.
 * 전역 링크는 다른 단계에 있어도 만족할 수 있으므로, 결정별 참조는 해당 단계
 * 경계 안에서 다시 대조한다.
 *
 * @param {object} step - 추출된 번호 단계
 * @param {string} href - 요구되는 상대 링크
 * @returns {boolean} 단계의 보이는 본문에 href가 있으면 true
 */
function stepHasLink(step, href) {
  const shape = extractDocShape(step.body);
  return shape.links.some((link) => link.href === href);
}

/**
 * reference 문서가 제목보다 앞선 조건부 로딩 지시를 갖는지 판정한다.
 * 첫 산문이 존재하는지만 보면 임의 배경 설명이 통과한다. 조건과 로딩 행동이라는
 * 최소 의미 단위만 확인해, 표현을 한 문장으로 고정하지 않으면서 route 계약을 지킨다.
 *
 * @param {string} markdown - 대상 reference 원문
 * @param {string[]} triggers - 조건부 로딩이 보존해야 하는 route 의미 단위
 * @returns {boolean} preamble 형태면 true
 */
function hasReferencePreamble(markdown, triggers = []) {
  const lines = stripHtmlComments(markdown).split(/\r?\n/);
  const start = lines[0] === '---' ? (extractFrontmatter(lines).endLine || 0) : 0;
  const content = lines.slice(start);
  const firstIndex = content.findIndex((line) => line.trim() !== '');
  const first = firstIndex === -1 ? null : content[firstIndex];
  // backtick·tilde fence 모두 조건부 preamble이 아니라 코드 예시의 시작이다.
  if (!first || /^\s*#/.test(first) || /^\s*(?:`{3,}|~{3,})/.test(first)) return false;
  const paragraph = [];
  for (const line of content.slice(firstIndex)) {
    if (line.trim() === '') break;
    paragraph.push(line);
  }
  return isConditionalLoadInstruction(paragraph.join(' '), triggers);
}

/**
 * 산문이 조건부 참조 로딩이라는 최소 의미를 가지는지 판정한다.
 * 동의어 집합은 문장 원문이 아니라 조건 시점과 참조 사용이라는 역할만 표현한다.
 * 따라서 번역·문장 다듬기는 허용하면서 단순 배경 설명이나 무조건 링크는 거부한다.
 *
 * @param {string} text - preamble 또는 링크가 있는 산문 행
 * @param {string[]} triggers - 조건부 로딩이 보존해야 하는 route 의미 단위
 * @returns {boolean} 조건 표지·로딩 행동·route 의미가 모두 있으면 true
 */
function isConditionalLoadInstruction(text, triggers = []) {
  const condition = /\b(?:when|after|before|on|if|unless|while|upon)\b/i;
  const load = /\b(?:read|load|consult|follow|apply)\b/i;
  // 링크 URL·라벨은 route 조건이 아니다. 예를 들어 recovery.md가 문장에 있는
  // 것만으로 recover 조건을 충족하면 링크 대상이 자기 계약을 위조한다.
  const prose = text.replace(/!?\[[^\]]*\]\([^)]*\)/g, '');
  // route별 핵심어만 별도 계약으로 받아 문장 전체를 정본화하지 않는다. 접미사는
  // dispatching·recovering 같은 자연스러운 활용을 허용한다.
  const routeTrigger = triggers.every((trigger) => {
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\w*\\b`, 'i').test(prose);
  });
  return condition.test(prose) && load.test(prose) && routeTrigger;
}

/**
 * boolean 기존 계약은 그대로 지원하고, route별 trigger를 명시한 객체만 의미 검사를
 * 강화한다. 이 배열은 문장 원문이 아니라 dispatch·recover 같은 역할 단위다.
 *
 * @param {boolean|{triggers?: string[]}|undefined} conditionalLoad - 조건부 로딩 계약
 * @returns {string[]} route 의미 단위
 */
function conditionalLoadTriggers(conditionalLoad) {
  return typeof conditionalLoad === 'object' && conditionalLoad !== null
    ? (conditionalLoad.triggers || [])
    : [];
}

/**
 * Markdown heading을 일반적인 fragment slug 형태로 정규화한다.
 *
 * @param {string} title - heading 제목
 * @returns {string} 비교 가능한 fragment slug
 */
function headingSlug(title) {
  return title.toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * fenced code 블록을 구조 계약의 본문에서 제외한다.
 * Markdown 예시는 실제 단계·ACQ·링크가 아니므로, 경계 탐색은 유지하면서 내부
 * 라벨을 계약 판정에 노출하지 않는다. fence가 닫히지 않은 문서도 끝까지 예시로
 * 취급해 잘린 문서가 가짜 계약으로 통과하지 않게 한다.
 *
 * @param {string} text - fence가 포함될 수 있는 Markdown 조각
 * @returns {string} fenced code가 제거된 텍스트
 */
function stripFencedCode(text) {
  const visible = [];
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const fenceResult = fenceTransition(line, fence);
    if (fenceResult.consumed) {
      fence = fenceResult.fence;
      continue;
    }
    if (!fence) visible.push(line);
  }
  return visible.join('\n');
}

// skill-shape.md 경로 분류용 기본 계약. Hard guards / Steps 예외는
// contractForKind가 문서 H2를 보고 치환한다. 단위 테스트의 단계 번호 계약은
// 여기서 강제하지 않는다 — CLI는 구조(frontmatter·필수 H2·말미 H2)만 본다.
const ACQ_GATES = 'ACQ (AskUserQuestion) gates';
const workflowSkillContract = {
  frontmatter: { required: ['name', 'description'], nonEmpty: ['description'] },
  headings: { required: [ACQ_GATES] },
};
const agentContract = {
  headings: {
    required: ['Authority', 'Hard guards', 'Output contract'],
    order: ['Authority', 'Hard guards', 'Output contract'],
  },
};
const subskillContract = {
  headings: {
    required: ['When this applies', 'Steps', 'Guardrails', 'Return'],
    order: ['When this applies', 'Steps', 'Guardrails', 'Return'],
  },
};

/**
 * 저장소 상대 경로를 skill-shape 문서 종류로 분류한다.
 * 계약이 없는 companion·NOTICE·skill-local reference는 null을 돌려 기본 스캔에서
 * 제외한다. 인자를 준 경우에는 호출부가 null을 오류로 처리한다.
 *
 * @param {string} relPath - cwd 기준 상대 경로
 * @returns {'workflow'|'agent'|'subskill'|null} 문서 종류
 */
function classifyDocPath(relPath) {
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (/^skills\/bouncer-[^/]+\/SKILL\.md$/.test(norm)) return 'workflow';
  if (/^agents\/[^/]+\.md$/.test(norm)) return 'agent';
  if (/^references\/[^/]+\/index\.md$/.test(norm)) return 'subskill';
  return null;
}

/**
 * Hard guards (read-only) / Decision ladder 예외를 반영한 실제 검사 계약을 만든다.
 * 정적 상수만 쓰면 read-only agent와 minimality가 거짓 실패한다.
 *
 * @param {'workflow'|'agent'|'subskill'} kind - 경로 분류
 * @param {string} markdown - 문서 원문
 * @returns {object} checkDocShape에 넘길 계약
 */
function contractForKind(kind, markdown) {
  if (kind === 'workflow') {
    return {
      ...workflowSkillContract,
      headings: { ...workflowSkillContract.headings },
    };
  }

  const h2Titles = extractDocShape(markdown).headings
    .filter((heading) => heading.level === 2)
    .map((heading) => heading.text);

  if (kind === 'agent') {
    const hardGuards = h2Titles.includes('Hard guards (read-only)')
      ? 'Hard guards (read-only)'
      : 'Hard guards';
    return {
      headings: {
        required: ['Authority', hardGuards, 'Output contract'],
        order: ['Authority', hardGuards, 'Output contract'],
      },
    };
  }

  // Decision ladder (in order)처럼 면제 H2에 부가 문구가 붙어도 절차 절로 인정한다.
  const procedural = h2Titles.find((title) => (
    title === 'Steps'
    || title === 'Core rules'
    || title === 'Decision ladder'
    || title.startsWith('Decision ladder ')
  )) || 'Steps';
  return {
    headings: {
      required: ['When this applies', procedural, 'Guardrails', 'Return'],
      order: ['When this applies', procedural, 'Guardrails', 'Return'],
    },
  };
}

/**
 * 필수 H2가 문서의 마지막 H2인지 확인한다.
 * checkOrder는 나열된 항목의 상대 순서만 보므로, ACQ/Output/Return 말미 계약을
 * 여기서 따로 강제한다.
 *
 * @param {object} shape - extractDocShape 결과
 * @param {string} expected - 마지막이어야 하는 H2 제목
 * @param {string[]} errors - 오류 누적 배열
 * @returns {void}
 */
function requireLastH2(shape, expected, errors) {
  const h2 = shape.headings.filter((heading) => heading.level === 2);
  if (h2.length === 0 || h2[h2.length - 1].text !== expected) {
    errors.push(`H2 must end with: ${expected}`);
  }
}

/**
 * cwd 아래에서 기본 스캔 대상 Markdown을 모은다.
 * skills·agents·references 트리를 걷되, classifyDocPath가 계약을 아는
 * 파일만 남긴다 — companion md에 subskill 계약을 씌우면 전부 거짓 실패한다.
 *
 * @param {string} cwd - 검사 루트
 * @returns {string[]} cwd 상대 경로 목록
 */
function defaultScanFiles(cwd) {
  const found = [];
  for (const tree of ['skills', 'agents', 'references']) {
    const absTree = path.join(cwd, tree);
    if (!fs.existsSync(absTree)) continue;
    collectMarkdown(absTree, cwd, found);
  }
  return found.filter((rel) => classifyDocPath(rel) !== null).sort();
}

/**
 * 디렉터리를 재귀적으로 걸어 .md 파일의 cwd 상대 경로를 모은다.
 *
 * @param {string} absDir - 절대 디렉터리
 * @param {string} cwd - 상대 경로 기준
 * @param {string[]} out - 누적 배열
 * @returns {void}
 */
function collectMarkdown(absDir, cwd, out) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdown(abs, cwd, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(path.relative(cwd, abs));
    }
  }
}

/**
 * 문서 구조 CLI 진입점. argv는 process.argv.slice(2)처럼 파일 인자만 받는다.
 * opts.cwd·stdout·stderr로 테스트에서 스트림을 주입할 수 있다.
 *
 * @param {string[]} argv - 검사할 상대/절대 파일 경로 (없으면 기본 스캔)
 * @param {{cwd?: string, stdout?: {write: Function}, stderr?: {write: Function}}} [opts]
 * @returns {number} 성공 0, 누락·계약 위반 1
 */
function runCli(argv = [], opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;
  const args = Array.isArray(argv) ? argv : [];

  const targets = args.length > 0
    ? args.map((arg) => {
      const abs = path.isAbsolute(arg) ? arg : path.resolve(cwd, arg);
      return path.relative(cwd, abs);
    })
    : defaultScanFiles(cwd);

  let failed = false;
  for (const rel of targets) {
    const abs = path.resolve(cwd, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      stderr.write(`check-doc-shape: missing file: ${rel}\n`);
      failed = true;
      continue;
    }

    const kind = classifyDocPath(rel.replace(/\\/g, '/'));
    if (!kind) {
      // 인자를 준 경로는 계약이 있어야 한다. 기본 스캔은 이미 필터했다.
      stderr.write(`check-doc-shape: no skill-shape contract for: ${rel}\n`);
      failed = true;
      continue;
    }

    let markdown;
    try {
      markdown = fs.readFileSync(abs, 'utf8');
    } catch (error) {
      stderr.write(`check-doc-shape: cannot read ${rel}: ${error.message}\n`);
      failed = true;
      continue;
    }

    const contract = contractForKind(kind, markdown);
    const result = checkDocShape(markdown, { ...contract, filePath: abs });
    const lastExpected = kind === 'workflow'
      ? ACQ_GATES
      : kind === 'agent'
        ? 'Output contract'
        : 'Return';
    requireLastH2(result.shape, lastExpected, result.errors);
    if (result.errors.length > 0) {
      failed = true;
      stderr.write(`check-doc-shape: ${rel}\n`);
      for (const error of result.errors) stderr.write(`  ${error}\n`);
    }
  }

  if (!failed) stdout.write(`check-doc-shape: ok (${targets.length} files)\n`);
  return failed ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  checkDocShape,
  extractDocShape,
  runCli,
  workflowSkillContract,
  agentContract,
  subskillContract,
};
