/**
 * Sparky Sums: a tiny original H5P game type for the Arcade's built-in sample.
 * Shows each sum with three answers to tap; reports the score with xAPI when done.
 */
var H5P = H5P || {};
H5P.SparkySums = (function () {
  function SparkySums(params, contentId) {
    H5P.EventDispatcher.call(this);
    this.params = params || {};
    this.contentId = contentId;
  }
  SparkySums.prototype = Object.create(H5P.EventDispatcher.prototype);
  SparkySums.prototype.constructor = SparkySums;

  SparkySums.prototype.attach = function ($container) {
    var self = this;
    var root = ($container && $container.get) ? $container.get(0) : $container;
    root.classList.add("sparky-sums");
    var qs = (self.params.questions || []).slice();
    var i = 0, score = 0, firstTry = true;
    function options(a) {
      var set = [a];
      var d = [1, 2, 3, 10, -1, -2, -10];
      var k = 0;
      while (set.length < 3) { var v = a + d[(a + k * 3) % d.length]; k++; if (v >= 0 && set.indexOf(v) < 0) set.push(v); }
      return set.sort(function () { return Math.random() - 0.5; });
    }
    function show() {
      root.innerHTML = "";
      var h = document.createElement("h2"); h.textContent = self.params.intro || "Solve the sums!"; root.appendChild(h);
      if (i >= qs.length) {
        var done = document.createElement("div"); done.className = "done";
        done.textContent = "All done! You got " + score + " out of " + qs.length + " first time.";
        root.appendChild(done);
        self.triggerXAPIScored(score, qs.length, "completed");
        return;
      }
      var q = document.createElement("div"); q.className = "q"; q.textContent = qs[i].q + " = ?"; root.appendChild(q);
      var row = document.createElement("div"); row.className = "opts"; root.appendChild(row);
      firstTry = true;
      options(qs[i].a).forEach(function (v) {
        var b = document.createElement("button"); b.textContent = String(v);
        b.onclick = function () {
          if (v === qs[i].a) { if (firstTry) score++; i++; show(); }
          else { firstTry = false; b.classList.add("wrong"); }
        };
        row.appendChild(b);
      });
    }
    show();
  };
  return SparkySums;
})();
