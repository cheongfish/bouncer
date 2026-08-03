'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
/** Format an instant as ISO-8601 with a fixed KST offset (Asia/Seoul, no DST). */
function nowIsoKst(date = new Date()) {
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
    const get = (type) => {
        const part = parts.find((p) => p.type === type);
        return part ? part.value : '00';
    };
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${ms}+09:00`;
}
module.exports = { nowIsoKst };
