'use strict';

/** 고정 KST 오프셋(Asia/Seoul, DST 없음)으로 instant를 ISO-8601 형식으로 포맷한다. */
function nowIsoKst(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type);
    return part ? part.value : '00';
  };
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${ms}+09:00`;
}

module.exports = { nowIsoKst };
