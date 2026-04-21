(function (root) {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toMin(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function fmt(min) {
    const h = pad(Math.floor((min % 1440) / 60));
    const m = pad(min % 60);
    return `${h}:${m}`;
  }

  function todayISO(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function collapseBlocks(free, slotMinutes, startMin) {
    const blocks = [];
    let i = 0;
    while (i < free.length) {
      if (free[i] === 0) { i++; continue; }
      let j = i;
      while (j < free.length && free[j] === free[i]) j++;
      blocks.push({
        startMin: startMin + i * slotMinutes,
        endMin: startMin + j * slotMinutes,
        lanes: free[i],
      });
      i = j;
    }
    return blocks;
  }

  function levelFor(raw, max) {
    if (raw <= 0) return 0;
    const r = raw / max;
    if (r <= 0.25) return 1;
    if (r <= 0.5) return 2;
    if (r <= 0.75) return 3;
    return 4;
  }

  function scheduleAgeDays(updatedISO, now) {
    if (!updatedISO) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(updatedISO);
    if (!m) return null;
    const upd = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((today - upd) / 86400000);
  }

  function icsEscape(s) {
    return String(s)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function icsUTCStamp(d) {
    return d.getUTCFullYear().toString()
      + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T"
      + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
  }

  const api = {
    pad, toMin, fmt, todayISO,
    collapseBlocks, levelFor, scheduleAgeDays,
    icsEscape, icsUTCStamp,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
})(typeof window !== "undefined" ? window : globalThis);
