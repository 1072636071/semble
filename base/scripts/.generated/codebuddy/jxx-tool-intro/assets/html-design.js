/* ==========================================================================
   Jxx Fresh — 模板交互（零依赖，可内联）
   提供：代码块复制、返回顶部、卡片筛选（可选）、滚动进度
   单一源：base/shared/html-template/html-design.js
   ========================================================================== */
(function () {
  'use strict';

  /* --- 代码块复制：给每个 .codeblk 注入复制按钮 --- */
  document.querySelectorAll('.codeblk pre').forEach(function (pre) {
    var blk = pre.closest('.codeblk');
    if (!blk || blk.querySelector('.codeblk__copy')) return;
    var bar = blk.querySelector('.codeblk__bar');
    if (!bar) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codeblk__copy';
    btn.textContent = '复制';
    btn.setAttribute('aria-label', '复制代码');

    btn.addEventListener('click', function () {
      var text = pre.innerText;
      var done = function () {
        btn.textContent = '已复制';
        btn.classList.add('is-done');
        setTimeout(function () {
          btn.textContent = '复制';
          btn.classList.remove('is-done');
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          fallbackCopy(text, done);
        });
      } else {
        fallbackCopy(text, done);
      }
    });

    bar.appendChild(btn);
  });

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      cb();
    } finally {
      document.body.removeChild(ta);
    }
  }

  /* --- 返回顶部 --- */
  var toTop = document.querySelector('.to-top');
  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    var onScroll = function () {
      toTop.classList.toggle('is-shown', window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- 卡片筛选：搜索框 + 分类胶囊 ---
     约定：[data-filter-input] 输入框，[data-filter-item] 可筛条目，
     条目上 data-filter-text 提供检索文本，[data-filter-chip] 提供分类值。 */
  var input = document.querySelector('[data-filter-input]');
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-filter-chip]'));
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-filter-item]'));
  var empty = document.querySelector('[data-filter-empty]');
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-filter-group]'));

  if (input || chips.length) {
    var active = '';
    var apply = function () {
      var q = (input && input.value || '').trim().toLowerCase();
      var shown = 0;
      items.forEach(function (el) {
        var text = (el.getAttribute('data-filter-text') || el.textContent || '').toLowerCase();
        var cat = el.getAttribute('data-filter-cat') || '';
        var ok = (!q || text.indexOf(q) >= 0) && (!active || cat === active);
        el.hidden = !ok;
        if (ok) shown++;
      });
      sections.forEach(function (sec) {
        var kids = Array.prototype.slice.call(sec.querySelectorAll('[data-filter-item]'));
        var has = kids.some(function (k) {
          return !k.hidden;
        });
        sec.hidden = !has;
      });
      if (empty) empty.hidden = shown !== 0;
    };

    if (input) {
      input.addEventListener('input', apply);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          input.value = '';
          apply();
        }
      });
    }
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var val = chip.getAttribute('data-filter-chip') || '';
        active = active === val ? '' : val;
        chips.forEach(function (c) {
          var on = c.getAttribute('data-filter-chip') === active;
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
          c.classList.toggle('is-active', on);
        });
        apply();
      });
    });
  }
})();
