/**
 * CRM Activity Tracking Script
 *
 * Add to your website before </body>:
 * <script src="https://crm.yourdomain.com/tracking.js" data-site="barnhaus"></script>
 *
 * Supported data attributes:
 * - data-site: Site identifier (e.g., "barnhaus", "empower")
 * - data-endpoint: Custom API endpoint (optional, defaults to same origin)
 * - data-debug: Set to "true" to enable console logging
 */
(function() {
  'use strict';

  // Configuration
  var STORAGE_KEY = '_crm_visitor_id';
  var LAST_VIEW_KEY = '_crm_last_view';
  var DEBOUNCE_MS = 5000; // Minimum time between page views (5s prevents Next.js hydration duplicates)
  var RETRY_ATTEMPTS = 2;
  var RETRY_DELAY_MS = 1000;

  // Get script element and configuration
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var config = {
    site: currentScript.getAttribute('data-site') || 'unknown',
    endpoint: currentScript.getAttribute('data-endpoint') || getDefaultEndpoint(),
    debug: currentScript.getAttribute('data-debug') === 'true'
  };

  // Get default endpoint from script src or hardcoded fallback
  function getDefaultEndpoint() {
    // Try to find tracking.js script tag in DOM
    var allScripts = document.getElementsByTagName('script');
    for (var i = 0; i < allScripts.length; i++) {
      var s = allScripts[i].getAttribute('src') || '';
      if (s.indexOf('tracking.js') !== -1 && s.indexOf('://') !== -1) {
        var p = s.split('/');
        return p[0] + '//' + p[2] + '/api/activities/track';
      }
    }
    // Hardcoded fallback — always points to CRM
    return 'https://crm.moderndwellings.com/api/activities/track';
  }

  // Debug logging
  function log() {
    if (config.debug && console && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[CRM Tracking]');
      console.log.apply(console, args);
    }
  }

  // Generate a random UUID v4
  function generateUUID() {
    var d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      d += performance.now();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Get or create visitor ID
  function getVisitorId() {
    var id = null;
    try {
      id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = generateUUID();
        localStorage.setItem(STORAGE_KEY, id);
        log('Generated new visitor ID:', id);
      } else {
        log('Retrieved visitor ID:', id);
      }
    } catch (e) {
      // localStorage might be disabled
      id = generateUUID();
      log('localStorage unavailable, using session ID:', id);
    }
    return id;
  }

  // Check if we should debounce this page view
  function shouldDebounce() {
    try {
      var lastView = localStorage.getItem(LAST_VIEW_KEY);
      if (lastView) {
        var lastTime = parseInt(lastView, 10);
        var now = Date.now();
        if (now - lastTime < DEBOUNCE_MS) {
          log('Debouncing page view (too soon after last view)');
          return true;
        }
      }
      localStorage.setItem(LAST_VIEW_KEY, Date.now().toString());
    } catch (e) {
      // Ignore localStorage errors
    }
    return false;
  }

  // Get page title, handling edge cases
  function getPageTitle() {
    var title = document.title || '';
    // Clean up common patterns
    title = title.replace(/^\s+|\s+$/g, ''); // Trim
    title = title.replace(/\s*[|\-–—]\s*$/, ''); // Remove trailing separators
    return title || 'Untitled Page';
  }

  // Get clean referrer
  function getReferrer() {
    var ref = document.referrer || '';
    // Don't include internal referrer (same domain)
    if (ref) {
      try {
        var refHost = new URL(ref).hostname;
        var currentHost = window.location.hostname;
        if (refHost === currentHost) {
          return ''; // Internal navigation
        }
      } catch (e) {
        // Invalid URL, return as is
      }
    }
    return ref;
  }

  // Send tracking request with retry
  function sendTrackingRequest(data, attempt) {
    attempt = attempt || 1;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', config.endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          log('Page view tracked successfully');
        } else if (attempt < RETRY_ATTEMPTS) {
          log('Tracking failed, retrying... (attempt ' + (attempt + 1) + ')');
          setTimeout(function() {
            sendTrackingRequest(data, attempt + 1);
          }, RETRY_DELAY_MS);
        } else {
          log('Tracking failed after ' + attempt + ' attempts');
        }
      }
    };

    xhr.onerror = function() {
      if (attempt < RETRY_ATTEMPTS) {
        log('Network error, retrying... (attempt ' + (attempt + 1) + ')');
        setTimeout(function() {
          sendTrackingRequest(data, attempt + 1);
        }, RETRY_DELAY_MS);
      } else {
        log('Network error after ' + attempt + ' attempts');
      }
    };

    try {
      xhr.send(JSON.stringify(data));
    } catch (e) {
      log('Failed to send tracking request:', e);
    }
  }

  // Track page view
  function trackPageView() {
    // Check debounce
    if (shouldDebounce()) {
      return;
    }

    var visitorId = getVisitorId();
    var pageUrl = window.location.href;
    var pageTitle = getPageTitle();
    var referrer = getReferrer();
    var fbCookies = getFacebookCookies();

    var data = {
      anonymous_id: visitorId,
      activity_type: 'page_view',
      title: 'Visited ' + pageTitle,
      page_url: pageUrl,
      metadata: {
        site: config.site,
        page_title: pageTitle,
        page_path: window.location.pathname,
        referrer: referrer || null,
        screen_width: window.screen ? window.screen.width : null,
        screen_height: window.screen ? window.screen.height : null,
        viewport_width: window.innerWidth || null,
        viewport_height: window.innerHeight || null,
        timezone: Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
        language: navigator.language || null,
        timestamp: new Date().toISOString(),
        // Facebook cookies for CAPI
        fbp: fbCookies.fbp || null,
        fbc: fbCookies.fbc || null,
        fbclid: getFbclid() || null
      }
    };

    log('Tracking page view:', data);
    sendTrackingRequest(data);
  }

  // Track custom events (exposed globally)
  function trackEvent(eventType, eventTitle, metadata) {
    var visitorId = getVisitorId();

    var data = {
      anonymous_id: visitorId,
      activity_type: eventType || 'page_view',
      title: eventTitle || 'Custom Event',
      page_url: window.location.href,
      metadata: Object.assign({
        site: config.site,
        page_path: window.location.pathname,
        timestamp: new Date().toISOString()
      }, metadata || {})
    };

    log('Tracking event:', data);
    sendTrackingRequest(data);
  }

  // Get visitor ID (exposed globally)
  function getPublicVisitorId() {
    return getVisitorId();
  }

  // Get a cookie by name
  function getCookie(name) {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();
      if (cookie.indexOf(name + '=') === 0) {
        return cookie.substring(name.length + 1);
      }
    }
    return null;
  }

  // Get Facebook cookies for Conversions API
  // fbp: Facebook browser pixel ID (format: fb.1.{timestamp}.{random})
  // fbc: Facebook click ID from ad click (format: fb.1.{timestamp}.{fbclid})
  function getFacebookCookies() {
    var fbp = getCookie('_fbp');
    var fbc = getCookie('_fbc');

    // If no fbc cookie but fbclid in URL, construct fbc value
    if (!fbc) {
      var urlParams = new URLSearchParams(window.location.search);
      var fbclid = urlParams.get('fbclid');
      if (fbclid) {
        // Format: fb.1.{timestamp}.{fbclid}
        fbc = 'fb.1.' + Date.now() + '.' + fbclid;
      }
    }

    log('Facebook cookies:', { fbp: fbp, fbc: fbc });

    return {
      fbp: fbp,
      fbc: fbc
    };
  }

  // Get fbclid from URL or cookie
  function getFbclid() {
    var urlParams = new URLSearchParams(window.location.search);
    var fbclid = urlParams.get('fbclid');
    if (fbclid) {
      return fbclid;
    }
    // Try to extract from fbc cookie
    var fbc = getCookie('_fbc');
    if (fbc) {
      // fbc format: fb.1.{timestamp}.{fbclid}
      var parts = fbc.split('.');
      if (parts.length >= 4) {
        return parts.slice(3).join('.');
      }
    }
    // Try localStorage fallback
    try {
      var stored = localStorage.getItem('_crm_fbclid');
      if (stored) return stored;
    } catch (e) {}
    return null;
  }

  // Save fbclid to _fbc cookie if present in URL (30-day expiry)
  function saveFbclidToCookie() {
    var urlParams = new URLSearchParams(window.location.search);
    var fbclid = urlParams.get('fbclid');
    if (fbclid) {
      // Format: fb.1.{timestamp}.{fbclid}
      var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
      var expires = new Date();
      expires.setDate(expires.getDate() + 30);
      document.cookie = '_fbc=' + fbc + ';expires=' + expires.toUTCString() + ';path=/;SameSite=Lax';
      log('Saved fbclid to _fbc cookie:', fbc);

      // Also save to localStorage as backup
      try {
        localStorage.setItem('_crm_fbclid', fbclid);
      } catch (e) {}
    }
  }

  // Initialize tracking
  function init() {
    log('Initializing with config:', config);

    // Save fbclid to cookie if present (before tracking page view)
    saveFbclidToCookie();

    // Track initial page view
    if (document.readyState === 'complete') {
      trackPageView();
    } else {
      window.addEventListener('load', trackPageView);
    }

    // Track SPA navigation (History API)
    var originalPushState = history.pushState;

    history.pushState = function() {
      originalPushState.apply(this, arguments);
      setTimeout(trackPageView, 0);
    };


    window.addEventListener('popstate', function() {
      setTimeout(trackPageView, 0);
    });

    log('Tracking initialized');
  }

  // Expose public API
  window.CRMTracking = {
    trackEvent: trackEvent,
    trackPageView: trackPageView,
    getVisitorId: getPublicVisitorId,
    getFacebookCookies: getFacebookCookies,
    getFbclid: getFbclid,
    config: config
  };

  // Initialize
  init();

})();
