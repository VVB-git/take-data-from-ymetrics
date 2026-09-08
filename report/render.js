(function () {
  var DASH = '—';

  function get(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc == null ? undefined : acc[key];
    }, obj);
  }

  function isEmpty(v) {
    return v === null || v === undefined || v === '';
  }

  function formatInt(v) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return Math.round(Number(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatDec(v, digits) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return Number(v).toFixed(digits).replace('.', ',');
  }

  function formatPct(v, digits) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return formatDec(v, digits) + ' %';
  }

  function formatPctShort(v) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return Math.round(Number(v)) + '%';
  }

  function formatMoney(v) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return formatInt(v) + ' ₽';
  }

  function formatCtr(v) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return formatDec(v, 2) + '%';
  }

  function formatFreq(v) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return formatDec(v, 2);
  }

  function formatDepth(v) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return formatDec(v, 2);
  }

  function formatBounce(v) {
    if (isEmpty(v) || isNaN(Number(v))) return DASH;
    return formatDec(v, 2) + ' %';
  }

  function formatText(v) {
    return isEmpty(v) ? DASH : String(v);
  }

  var FORMATTERS = {
    int: formatInt,
    dec2: function (v) { return formatDec(v, 2); },
    pct1: function (v) { return formatPct(v, 1); },
    pct0: formatPctShort,
    money: formatMoney,
    ctr: formatCtr,
    freq: formatFreq,
    depth: formatDepth,
    bounce: formatBounce,
    text: formatText
  };

  function bindTexts(report) {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var path = el.getAttribute('data-bind');
      var fmt = el.getAttribute('data-fmt') || 'text';
      var fn = FORMATTERS[fmt] || formatText;
      el.textContent = fn(get(report, path));
    });
  }

  function renderAgeBars(report) {
    var host = document.getElementById('age-bars');
    if (!host) return;
    var rows = report.ageShare || [];
    var max = rows.reduce(function (m, r) {
      return Math.max(m, Number(r.value) || 0);
    }, 0) || 1;
    host.innerHTML = rows.map(function (r) {
      var cls = r.key === 'unknown' ? ' bar-row unknown' : ' bar-row';
      var w = Math.max(4, (Number(r.value) || 0) / max * 100);
      return (
        '<div class="' + cls.trim() + '">' +
          '<span>' + formatText(r.label) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%"></div></div>' +
          '<span>' + formatPctShort(r.value) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderAgeStats(report) {
    var host = document.getElementById('age-stats');
    if (!host) return;
    var rows = report.ageBehavior || [];
    host.innerHTML = rows.map(function (r) {
      return (
        '<div class="stat-block age">' +
          '<div class="pill-head">' + formatText(r.label) + '</div>' +
          '<div class="pill"><span class="lab">Отказы:</span> ' + formatBounce(r.bounceRate) + '</div>' +
          '<div class="pill"><span class="lab">Глубина просмотра:</span> ' + formatDepth(r.pageDepth) + '</div>' +
          '<div class="pill"><span class="lab">Время на сайте:</span> ' + formatText(r.avgDuration) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function dashNum(v) {
    if (v === null || v === undefined || v === '') return DASH;
    return formatInt(v);
  }

  function renderConversions(report) {
    var host = document.getElementById('conv-postclick');
    if (host && report.conversions && report.conversions.postClick) {
      host.innerHTML = report.conversions.postClick.map(function (row) {
        return (
          '<div class="tbl-row">' +
            '<div class="c-name">' + formatText(row.name) + '</div>' +
            '<div class="c-num">' + dashNum(row.direct) + '</div>' +
            '<div class="c-num">' + dashNum(row.associated) + '</div>' +
          '</div>'
        );
      }).join('');
    }
    var pv = document.getElementById('conv-postview');
    if (pv && report.conversions && report.conversions.postView) {
      pv.innerHTML = report.conversions.postView.map(function (row) {
        return (
          '<div class="tbl-row pv">' +
            '<div class="c-name">' + formatText(row.name) + '</div>' +
            '<div class="c-num wide">' + dashNum(row.count) + '</div>' +
          '</div>'
        );
      }).join('');
    }
    var notes = document.getElementById('conv-notes');
    if (notes && report.conversions && report.conversions.notes) {
      notes.innerHTML = report.conversions.notes.map(function (n) {
        return '<p>' + formatText(n) + '</p>';
      }).join('');
    }
  }

  function renderPostView(report) {
    var host = document.getElementById('postview-rows');
    if (!host || !report.postView) return;
    host.innerHTML = (report.postView.items || []).map(function (row) {
      return (
        '<div class="tbl-row">' +
          '<div class="c-name">' + formatText(row.name) + '</div>' +
          '<div class="c-num wide">' + dashNum(row.count) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderBanners(report) {
    var host = document.getElementById('banners-list');
    if (!host) return;
    host.innerHTML = (report.banners || []).map(function (b) {
      return (
        '<article class="banner-card">' +
          '<div class="banner-thumb" aria-hidden="true"></div>' +
          '<div class="banner-metrics">' +
            '<div class="pill"><span class="lab">CTR</span> ' + formatCtr(b.ctr) + '</div>' +
            '<div class="pill"><span class="lab">Клики</span> ' + formatInt(b.clicks) + '</div>' +
            '<div class="pill"><span class="lab">Показы</span> ' + formatInt(b.impressions) + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }
    return 'conic-gradient(' + stops + ')';
  }

  function renderCharts(report) {
    var mp = report.mediaPlan || {};
    var plan = Number(mp.planClicks) || 0;
    var fact = Number(mp.factClicks) || 0;
    var total = plan + fact;
    var clicks = document.getElementById('clicks-donut');
    if (clicks && total) {
      var planDeg = (plan / total) * 360;
      clicks.style.background = conic(
        'from 200deg, var(--purple) 0 ' + planDeg + 'deg, var(--purple-soft) ' + planDeg + 'deg 360deg'
      );
    }

    var d = report.devicesShare || {};
    var desk = Number(d.desktop) || 0;
    var tab = Number(d.tablet) || 0;
    var mob = Number(d.mobile) || 0;
    var sum = desk + tab + mob || 1;
    var d1 = (mob / sum) * 360;
    var d2 = d1 + (tab / sum) * 360;
    var deviceDonut = document.getElementById('device-donut');
    if (deviceDonut) {
      deviceDonut.style.background = conic(
        'from 110deg, var(--purple) 0 ' + d1 + 'deg, var(--magenta) ' + d1 + 'deg ' + d2 + 'deg, #c9c6ff ' + d2 + 'deg 360deg'
      );
    }

    var g = report.genderShare || {};
    var male = Number(g.male) || 0;
    var female = Number(g.female) || 0;
    var maleEl = document.getElementById('gender-male');
    var femaleEl = document.getElementById('gender-female');
    if (maleEl) {
      maleEl.style.background = conic(
        'var(--male) 0 ' + male * 3.6 + 'deg, #dfe2f5 ' + male * 3.6 + 'deg 360deg'
      );
    }
    if (femaleEl) {
      femaleEl.style.background = conic(
        'var(--magenta) 0 ' + female * 3.6 + 'deg, #f3e4f7 ' + female * 3.6 + 'deg 360deg'
      );
    }
  }

  function render(report) {
    if (!report) return;
    bindTexts(report);
    renderAgeBars(report);
    renderAgeStats(report);
    renderCharts(report);
    renderConversions(report);
    renderPostView(report);
    renderBanners(report);
  }

  window.renderReport = render;
  render(window.REPORT);
})();
