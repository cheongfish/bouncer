'use strict';
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import coordinatorWorker = require('./coordinator-worker');
const { readBouncerBlock } = coordinatorWorker;

// 리뷰 수정 상태(repair 사용 여부·root review.md 라운드 존재)의 단일 판독 지점이다.
// repair 접수 경계(coordinator-repair)와 다음 작업 선택(coordinate-next)이 같은 원장·문서에서
// 서로 다른 답을 내지 않도록 모았다. review-policy.ts는 fs·schema 무의존 상수 경계라
// 파일을 읽는 이 판독은 그곳에 둘 수 없어 별도 모듈로 분리했다.

/** round 판독의 오류 정책. strict는 ENOENT만 흡수하고, tolerant는 읽기 불가 문서를 없음으로 본다. */
type RoundErrorPolicy = 'strict' | 'tolerant';

/**
 * 원장 decisions에 리뷰 원인 repair(`kind: 'repair'`, `failure.command: 'review'`)가 이미 있는지
 * 판정한다. 입력 배열만 읽고 바꾸지 않는 순수 predicate라 호출자가 같은 원장에서 같은 답을 얻는다.
 *
 * @param {readonly unknown[] | undefined} decisions - 원장 decisions(부재 허용)
 * @returns {boolean} 리뷰 원인 repair decision이 있으면 true
 */
function hasReviewRepairDecision(decisions: readonly unknown[] | undefined): boolean {
  return (decisions || []).some((entry) => {
    const item = entry as { kind?: unknown; failure?: { command?: unknown } } | null;
    return item?.kind === 'repair' && item.failure?.command === 'review';
  });
}

/**
 * review.md의 `bouncer.review.rounds[]`에 주어진 mode의 라운드가 있는지 읽는다.
 * 오류 의미는 호출자 정책으로 갈린다. 이 차이는 의도된 유지이며 통일하지 않는다.
 * - strict: 문서 부재(ENOENT)만 false로 흡수한다. YAML 파손 같은 다른 실패를 없음으로 접으면
 *   이미 끝난 리뷰에 repair·supplement가 다시 열리므로 그대로 던진다(repair 접수 경계용).
 * - tolerant: 문서 부재·frontmatter 없음·깨진 YAML을 없음으로 본다. 판독 불가를 예외로 올리면
 *   다음 작업 선택이 막히기 때문이다. 그 밖의 I/O 오류는 readBouncerBlock이 그대로 던진다.
 *
 * @param {{ file: string; error_policy: RoundErrorPolicy }} input - review.md 절대 경로와 오류 정책
 * @param {'discovery' | 'delta'} mode - 찾을 라운드 mode
 * @returns {boolean} 해당 mode 라운드가 있으면 true
 */
function reviewRoundExists(
  input: { file: string; error_policy: RoundErrorPolicy },
  mode: 'discovery' | 'delta',
): boolean {
  let review: unknown;
  if (input.error_policy === 'strict') {
    let data: unknown;
    try {
      data = readDoc(input.file).data;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return false;
      throw error;
    }
    review = (data as { bouncer?: { review?: unknown } } | undefined)?.bouncer?.review;
  } else {
    review = readBouncerBlock(input.file)?.review;
  }
  const rounds = (review as { rounds?: unknown } | null | undefined)?.rounds;
  return Array.isArray(rounds)
    && rounds.some((round) => (round as { mode?: unknown } | null)?.mode === mode);
}

export = { hasReviewRepairDecision, reviewRoundExists };
