// Roca's Painting, LLC — shared site behavior

(function () {
  "use strict";

  /* Mobile nav toggle */
  var navToggle = document.querySelector(".nav-toggle");
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var isOpen = document.body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.querySelectorAll(".mobile-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Desktop "Painting" nav dropdown — click-toggle is the primary
     mechanism (works for touch/keyboard); CSS :hover is a bonus on top. */
  document.querySelectorAll(".nav-dropdown-trigger").forEach(function (trigger) {
    var navItem = trigger.closest(".nav-item");
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = navItem.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });

  document.addEventListener("click", function (e) {
    document.querySelectorAll(".nav-item.has-dropdown.is-open").forEach(function (item) {
      if (!item.contains(e.target)) {
        item.classList.remove("is-open");
        var trigger = item.querySelector(".nav-dropdown-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      document.querySelectorAll(".nav-item.has-dropdown.is-open").forEach(function (item) {
        item.classList.remove("is-open");
        var trigger = item.querySelector(".nav-dropdown-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }
  });

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* Scroll reveal — elements are visible by default; only hide-then-reveal
     once JS has actually confirmed it can run the observer. */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      el.classList.add("reveal-pending");
      observer.observe(el);
    });
  }

  /* Mobile-only carousels (reviews, process steps on the homepage).
     Swipeable via native scroll-snap; auto-advances every 2.5s; pauses
     while the user is actively touching it; only runs under 1000px. */
  function initCarousel(containerId, dotsId, intervalMs) {
    var container = document.getElementById(containerId);
    var dotsWrap = document.getElementById(dotsId);
    if (!container || !dotsWrap) return;

    var dots = Array.prototype.slice.call(dotsWrap.children);
    var mq = window.matchMedia("(max-width: 999px)");
    var timer = null;
    var currentIndex = 0;

    function setActiveDot(index) {
      dots.forEach(function (d, i) {
        d.classList.toggle("active", i === index);
      });
    }

    function goTo(index, smooth) {
      var items = container.children;
      if (!items.length) return;
      index = ((index % items.length) + items.length) % items.length;
      currentIndex = index;
      var itemRect = items[index].getBoundingClientRect();
      var containerRect = container.getBoundingClientRect();
      var targetLeft = container.scrollLeft + (itemRect.left - containerRect.left);
      container.scrollTo({ left: targetLeft, behavior: smooth === false ? "auto" : "smooth" });
      setActiveDot(index);
    }

    function closestIndex() {
      var items = container.children;
      var containerRect = container.getBoundingClientRect();
      var closest = 0;
      var closestDist = Infinity;
      for (var i = 0; i < items.length; i++) {
        var dist = Math.abs(items[i].getBoundingClientRect().left - containerRect.left);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }
      return closest;
    }

    function start() {
      stop();
      timer = setInterval(function () {
        goTo(currentIndex + 1);
      }, intervalMs);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    var scrollSettle;
    container.addEventListener(
      "scroll",
      function () {
        clearTimeout(scrollSettle);
        scrollSettle = setTimeout(function () {
          currentIndex = closestIndex();
          setActiveDot(currentIndex);
        }, 120);
      },
      { passive: true }
    );

    container.addEventListener("touchstart", stop, { passive: true });
    container.addEventListener(
      "touchend",
      function () {
        if (mq.matches) start();
      },
      { passive: true }
    );

    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        goTo(i);
        if (mq.matches) start();
      });
    });

    function handleMqChange(e) {
      if (e.matches) {
        goTo(0, false);
        start();
      } else {
        stop();
      }
    }

    if (mq.addEventListener) {
      mq.addEventListener("change", handleMqChange);
    }
    if (mq.matches) {
      setActiveDot(0);
      start();
    }
  }

  initCarousel("reviews-carousel", "reviews-dots", 2500);
  initCarousel("process-carousel", "process-dots", 2500);

  /* Estimate form: AJAX submit to Formspree so we can show inline success/error */
  var form = document.querySelector(".estimate-form");
  if (form) {
    var successEl = form.querySelector(".form-success");
    var errorEl = form.querySelector(".form-error");
    var submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (successEl) successEl.classList.remove("show");
      if (errorEl) errorEl.classList.remove("show");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = "Sending…";
      }

      var data = new FormData(form);

      fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          if (response.ok) {
            form.reset();
            if (successEl) successEl.classList.add("show");
          } else {
            if (errorEl) errorEl.classList.add("show");
          }
        })
        .catch(function () {
          if (errorEl) errorEl.classList.add("show");
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText;
          }
        });
    });
  }
})();
